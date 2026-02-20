from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
import logging

from app.api.deps import get_db
from app.api.errors import not_found
from app.api.schemas import Episode, PaginatedTitles, Title
from app.db.models import Episode as EpisodeModel
from app.db.models import SubtitleLine
from app.services.cache_service import warmup_episode_chunks_cache
from app.services.catalog_service import get_title, list_episodes, list_titles

router = APIRouter(tags=["Catalog"])
logger = logging.getLogger(__name__)


@router.get("/titles", response_model=PaginatedTitles)
def get_titles(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = None,
    db: Session = Depends(get_db),
):
    del cursor
    titles = list_titles(db, limit=limit)
    return PaginatedTitles(
        items=[
            Title(
                id=title.id,
                name=title.name,
                description=title.description,
                thumbnail_url=title.thumbnail_url,
                created_at=title.created_at.isoformat() if title.created_at else None,
            )
            for title in titles
        ],
        next_cursor=None,
    )


@router.get("/titles/{titleId}", response_model=Title)
def get_title_by_id(titleId: str, db: Session = Depends(get_db)):
    title = get_title(db, titleId)
    if title is None:
        raise not_found()
    return Title(
        id=title.id,
        name=title.name,
        description=title.description,
        thumbnail_url=title.thumbnail_url,
        created_at=title.created_at.isoformat() if title.created_at else None,
    )


@router.get("/titles/{titleId}/episodes")
def get_title_episodes(
    titleId: str,
    season: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    title = get_title(db, titleId)
    if title is None:
        raise not_found()

    episodes = list_episodes(db, title_id=titleId, season=season)
    return {
        "title_id": titleId,
        "episodes": [
            Episode(
                id=episode.id,
                title_id=episode.title_id,
                season=episode.season,
                episode_number=episode.episode_number,
                name=episode.name,
                duration_ms=episode.duration_ms,
                video_url=episode.video_url,
            )
            for episode in episodes
        ],
    }


@router.get("/episodes/{episodeId}/subtitles")
def get_episode_subtitles(
    episodeId: str,
    limit: int = Query(default=5000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    episode = db.scalar(select(EpisodeModel).where(EpisodeModel.id == episodeId))
    if episode is None:
        raise not_found("Episode not found.")

    lines = db.scalars(
        select(SubtitleLine)
        .where(SubtitleLine.episode_id == episodeId)
        .order_by(SubtitleLine.start_ms.asc())
        .limit(limit)
    ).all()

    return {
        "episode_id": episodeId,
        "items": [
            {
                "id": line.id,
                "start_ms": line.start_ms,
                "end_ms": line.end_ms,
                "speaker_text": line.speaker_text,
                "text": line.text,
            }
            for line in lines
        ],
    }


@router.post("/episodes/{episodeId}/cache/warmup")
def warmup_episode_cache(
    episodeId: str,
    db: Session = Depends(get_db),
):
    episode = db.scalar(select(EpisodeModel).where(EpisodeModel.id == episodeId))
    if episode is None:
        raise not_found("Episode not found.")
    cached_chunks = warmup_episode_chunks_cache(db, episodeId)
    logger.info(
        "episode_cache_warmup episode_id=%s cached_chunks=%s",
        episodeId,
        cached_chunks,
    )
    return {"episode_id": episodeId, "cached_chunks": cached_chunks}
