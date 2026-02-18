from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, select

from app.core.config import get_settings
from app.db.base import Base
from app.db.models import Episode, SubtitleChunk, SubtitleLine
from app.db.session import SessionLocal, engine


def now():
    return datetime.now(timezone.utc)


def simple_embedding(text: str) -> list[float]:
    # lightweight fallback embedding for local demo.
    base = [0.0, 0.0, 0.0, 0.0]
    for idx, ch in enumerate(text[:120]):
        base[idx % 4] += (ord(ch) % 97) / 97.0
    return [round(value / max(1, len(text[:120])), 6) for value in base]


def run() -> None:
    settings = get_settings()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        chunk_size = max(2, settings.chunk_size_lines)

        episodes = list(db.scalars(select(Episode)).all())
        for episode in episodes:
            db.execute(delete(SubtitleChunk).where(SubtitleChunk.episode_id == episode.id))

            lines = list(
                db.scalars(
                    select(SubtitleLine)
                    .where(SubtitleLine.episode_id == episode.id)
                    .order_by(SubtitleLine.start_ms.asc())
                ).all()
            )

            for idx in range(0, len(lines), chunk_size):
                group = lines[idx : idx + chunk_size]
                if not group:
                    continue

                text_concat = ' '.join(line.text for line in group)
                chunk = SubtitleChunk(
                    id=str(uuid4()),
                    episode_id=episode.id,
                    start_ms=group[0].start_ms,
                    end_ms=group[-1].end_ms,
                    text_concat=text_concat,
                    subtitle_line_ids=[line.id for line in group],
                    embedding=simple_embedding(text_concat),
                    created_at=now(),
                )
                db.add(chunk)

        db.commit()
        print('Chunk build complete')
    finally:
        db.close()


if __name__ == '__main__':
    run()
