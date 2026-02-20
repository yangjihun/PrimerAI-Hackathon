from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import SubtitleChunk, SubtitleLine


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _simple_embedding(text: str) -> list[float]:
    # Lightweight fallback embedding used for local/demo retrieval.
    base = [0.0, 0.0, 0.0, 0.0]
    for idx, ch in enumerate(text[:120]):
        base[idx % 4] += (ord(ch) % 97) / 97.0
    return [round(value / max(1, len(text[:120])), 6) for value in base]


def rebuild_chunks_for_episodes(db: Session, episode_ids: list[str]) -> None:
    if not episode_ids:
        return

    settings = get_settings()
    chunk_size = max(2, settings.chunk_size_lines)

    db.execute(delete(SubtitleChunk).where(SubtitleChunk.episode_id.in_(episode_ids)))

    for episode_id in episode_ids:
        lines = list(
            db.scalars(
                select(SubtitleLine)
                .where(SubtitleLine.episode_id == episode_id)
                .order_by(SubtitleLine.start_ms.asc())
            ).all()
        )

        for idx in range(0, len(lines), chunk_size):
            group = lines[idx : idx + chunk_size]
            if not group:
                continue

            text_concat = ' '.join(line.text for line in group)
            db.add(
                SubtitleChunk(
                    id=str(uuid4()),
                    episode_id=episode_id,
                    start_ms=group[0].start_ms,
                    end_ms=group[-1].end_ms,
                    text_concat=text_concat,
                    subtitle_line_ids=[line.id for line in group],
                    embedding=_simple_embedding(text_concat),
                    created_at=_now(),
                )
            )

