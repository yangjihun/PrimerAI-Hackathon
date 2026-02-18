from __future__ import annotations

import re
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import SubtitleChunk, SubtitleLine

WORD_RE = re.compile(r"[A-Za-z0-9가-힣_]+")


def _tokenize(text: str) -> list[str]:
    return [token.lower() for token in WORD_RE.findall(text)]


def _score(query: str, text: str) -> float:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return 0.0
    q_counter = Counter(query_tokens)
    t_counter = Counter(_tokenize(text))
    overlap = sum(min(q_counter[token], t_counter[token]) for token in q_counter)
    return overlap / max(1, len(query_tokens))


def retrieve_chunks(
    db: Session,
    *,
    episode_id: str,
    current_time_ms: int,
    query: str,
    top_k: int | None = None,
) -> list[SubtitleChunk]:
    settings = get_settings()
    limit = top_k or settings.retrieval_top_k

    # Time guard: retrieval must exclude future context.
    stmt = (
        select(SubtitleChunk)
        .where(
            SubtitleChunk.episode_id == episode_id,
            SubtitleChunk.start_ms <= current_time_ms,
        )
        .order_by(SubtitleChunk.start_ms.desc())
        .limit(120)
    )
    chunks = list(db.scalars(stmt).all())
    if not chunks:
        return []

    scored = [(chunk, _score(query, chunk.text_concat)) for chunk in chunks]
    scored.sort(key=lambda item: (item[1], item[0].start_ms), reverse=True)
    return [chunk for chunk, _ in scored[:limit]]


def resolve_lines_from_chunks(
    db: Session,
    *,
    episode_id: str,
    current_time_ms: int,
    chunks: list[SubtitleChunk],
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
