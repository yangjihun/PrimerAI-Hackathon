from __future__ import annotations

import logging
import re
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import SubtitleChunk, SubtitleLine
from app.services.cache_service import get_cached_episode_chunks

WORD_RE = re.compile(r"[A-Za-z0-9가-힣_]+")
MIN_TOKEN_LEN = 2
STOPWORDS = {
    # Korean lightweight stopwords
    "은", "는", "이", "가", "을", "를", "에", "의", "도", "와", "과", "로", "으로",
    "한", "하다", "했다", "해", "에서", "에게", "처럼", "까지", "부터", "그리고", "그런데",
    "근데", "지금", "그냥", "정말", "진짜", "그거", "이거", "저거", "것", "수", "좀",
    "뭐", "왜", "어떻게", "어디", "누가", "누구", "있다", "없다", "있는", "없는",
    "이런", "저런", "그런", "아", "음", "어", "응", "네", "예",
    # English lightweight stopwords
    "the", "a", "an", "of", "to", "in", "on", "at", "for", "and", "or", "is", "are",
    "was", "were", "be", "been", "being", "it", "this", "that", "with", "as", "by",
}
logger = logging.getLogger(__name__)


@dataclass
class RetrievalChunk:
    start_ms: int
    text_concat: str
    subtitle_line_ids: list[str]
    embedding: list[float] | None = None


def _tokenize(text: str) -> list[str]:
    normalized = text.lower().replace("：", ":")
    tokens: list[str] = []
    for token in WORD_RE.findall(normalized):
        if token in STOPWORDS:
            continue
        if not token.isdigit() and len(token) < MIN_TOKEN_LEN:
            continue
        tokens.append(token)
    return tokens


def _score_tokens(query_tokens: list[str], text: str) -> float:
    if not query_tokens:
        return 0.0
    q_counter = Counter(query_tokens)
    t_counter = Counter(_tokenize(text))
    overlap = sum(min(q_counter[token], t_counter[token]) for token in q_counter)
    return overlap / max(1, len(query_tokens))


def _simple_embedding(text: str) -> list[float]:
    base = [0.0, 0.0, 0.0, 0.0]
    for idx, ch in enumerate(text[:120]):
        base[idx % 4] += (ord(ch) % 97) / 97.0
    return [round(value / max(1, len(text[:120])), 6) for value in base]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return max(-1.0, min(1.0, dot / (norm_a * norm_b)))


def retrieve_chunks(
    db: Session,
    *,
    episode_id: str,
    current_time_ms: int,
    query: str,
    top_k: int | None = None,
) -> list[RetrievalChunk]:
    settings = get_settings()
    limit = top_k or settings.retrieval_top_k

    chunks: list[RetrievalChunk] = []
    cached = get_cached_episode_chunks(episode_id)
    if cached:
        logger.info(
            "rag_cache_hit episode_id=%s cache_chunks=%s current_time_ms=%s",
            episode_id,
            len(cached),
            current_time_ms,
        )
        chunks = [
            RetrievalChunk(
                start_ms=int(item.get("start_ms") or 0),
                text_concat=str(item.get("text_concat") or ""),
                subtitle_line_ids=[str(v) for v in (item.get("subtitle_line_ids") or [])],
                embedding=[float(v) for v in (item.get("embedding") or [])] or None,
            )
            for item in cached
            if int(item.get("start_ms") or 0) <= current_time_ms
        ]
        chunks.sort(key=lambda item: item.start_ms, reverse=True)
        chunks = chunks[:120]
    else:
        logger.info("rag_cache_miss episode_id=%s current_time_ms=%s", episode_id, current_time_ms)
        stmt = (
            select(SubtitleChunk)
            .where(
                SubtitleChunk.episode_id == episode_id,
                SubtitleChunk.start_ms <= current_time_ms,
            )
            .order_by(SubtitleChunk.start_ms.desc())
            .limit(120)
        )
        rows = list(db.scalars(stmt).all())
        chunks = [
            RetrievalChunk(
                start_ms=row.start_ms,
                text_concat=row.text_concat,
                subtitle_line_ids=row.subtitle_line_ids or [],
                embedding=row.embedding,
            )
            for row in rows
        ]

    if not chunks:
        return []

    query_tokens = _tokenize(query)
    query_embedding = _simple_embedding(query)
    scored: list[tuple[RetrievalChunk, float]] = []
    for chunk in chunks:
        lexical = _score_tokens(query_tokens, chunk.text_concat)
        vector = _cosine_similarity(query_embedding, chunk.embedding or [])
        score = (0.35 * lexical) + (0.65 * max(0.0, vector))
        scored.append((chunk, score))
    scored.sort(key=lambda item: (item[1], item[0].start_ms), reverse=True)
    return [chunk for chunk, _ in scored[:limit]]


def resolve_lines_from_chunks(
    db: Session,
    *,
    episode_id: str,
    current_time_ms: int,
    chunks: list[RetrievalChunk],
    max_lines: int = 6,
) -> list[SubtitleLine]:
    line_ids: list[str] = []
    for chunk in chunks:
        line_ids.extend(chunk.subtitle_line_ids or [])

    if not line_ids:
        return []

    stmt = (
        select(SubtitleLine)
        .where(
            SubtitleLine.id.in_(line_ids),
            SubtitleLine.episode_id == episode_id,
            SubtitleLine.start_ms <= current_time_ms,
        )
        .order_by(SubtitleLine.start_ms.desc())
        .limit(max_lines)
    )
    return list(reversed(list(db.scalars(stmt).all())))


def fallback_recent_lines(
    db: Session,
    *,
    episode_id: str,
    current_time_ms: int,
    max_lines: int = 6,
) -> list[SubtitleLine]:
    stmt = (
        select(SubtitleLine)
        .where(
            SubtitleLine.episode_id == episode_id,
            SubtitleLine.start_ms <= current_time_ms,
        )
        .order_by(SubtitleLine.start_ms.desc())
        .limit(max_lines)
    )
    return list(reversed(list(db.scalars(stmt).all())))

