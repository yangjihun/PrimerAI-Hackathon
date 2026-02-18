from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Episode, Title


def list_titles(db: Session, *, limit: int = 50) -> list[Title]:
    stmt = select(Title).order_by(Title.created_at.desc()).limit(limit)
    return list(db.scalars(stmt).all())


def get_title(db: Session, title_id: str) -> Title | None:
    return db.scalar(select(Title).where(Title.id == title_id))


def list_episodes(db: Session, *, title_id: str, season: int | None = None) -> list[Episode]:
    stmt = select(Episode).where(Episode.title_id == title_id)
    if season is not None:
        stmt = stmt.where(Episode.season == season)
    stmt = stmt.order_by(Episode.season.asc(), Episode.episode_number.asc())
    return list(db.scalars(stmt).all())
