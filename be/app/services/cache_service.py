from __future__ import annotations

import json
from functools import lru_cache
from typing import Any
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import SubtitleChunk

try:
    import redis
except Exception:  # pragma: no cover - optional runtime dependency
    redis = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


def _key_episode_chunks(episode_id: str) -> str:
    return f'netplus:episode:{episode_id}:chunks'


@lru_cache(maxsize=1)
def _redis_client():
    settings = get_settings()
    if not settings.redis_url or redis is None:
        logger.info('redis_cache_disabled reason=%s', 'missing_redis_url_or_package')
        return None
    try:
        client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        logger.info('redis_cache_enabled')
        return client
    except Exception:
        logger.exception('redis_cache_connection_failed')
        return None


def is_cache_enabled() -> bool:
    return _redis_client() is not None


def get_cached_episode_chunks(episode_id: str) -> list[dict[str, Any]] | None:
    client = _redis_client()
    if client is None:
        return None
    try:
        raw = client.get(_key_episode_chunks(episode_id))
        if not raw:
            return None
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else None
    except Exception:
        return None


def warmup_episode_chunks_cache(db: Session, episode_id: str) -> int:
    client = _redis_client()
    if client is None:
        return 0

    chunks = list(
        db.scalars(
            select(SubtitleChunk)
            .where(SubtitleChunk.episode_id == episode_id)
            .order_by(SubtitleChunk.start_ms.asc())
        ).all()
    )
    payload = [
        {
            'id': chunk.id,
            'episode_id': chunk.episode_id,
            'start_ms': chunk.start_ms,
            'end_ms': chunk.end_ms,
            'text_concat': chunk.text_concat,
            'subtitle_line_ids': chunk.subtitle_line_ids or [],
            'embedding': chunk.embedding,
        }
        for chunk in chunks
    ]

    ttl = max(60, get_settings().redis_cache_ttl_seconds)
    try:
        client.setex(_key_episode_chunks(episode_id), ttl, json.dumps(payload, ensure_ascii=False))
        return len(payload)
    except Exception:
        return 0


def invalidate_episode_chunks_cache(episode_id: str) -> None:
    client = _redis_client()
    if client is None:
        return
    try:
        client.delete(_key_episode_chunks(episode_id))
    except Exception:
        return
