from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.errors import not_found
from app.api.schemas import Episode, PaginatedTitles, Title
from app.services.catalog_service import get_title, list_episodes, list_titles

router = APIRouter(tags=['Catalog'])


@router.get('/titles', response_model=PaginatedTitles)
def get_titles(limit: int = Query(default=50, ge=1, le=100), cursor: str | None = None, db: Session = Depends(get_db)):
    del cursor  # cursor pagination can be added after MVP
    titles = list_titles(db, limit=limit)
    return PaginatedTitles(
        items=[
            Title(
                id=title.id,
                name=title.name,
                description=title.description,
                created_at=title.created_at.isoformat() if title.created_at else None,
            )
            for title in titles
        ],
        next_cursor=None,
    )


@router.get('/titles/{titleId}', response_model=Title)
def get_title_by_id(titleId: str, db: Session = Depends(get_db)):
    title = get_title(db, titleId)
    if title is None:
        raise not_found()
    return Title(
        id=title.id,
        name=title.name,
        description=title.description,
        created_at=title.created_at.isoformat() if title.created_at else None,
    )


@router.get('/titles/{titleId}/episodes')
def get_title_episodes(titleId: str, season: int | None = Query(default=None, ge=1), db: Session = Depends(get_db)):
    title = get_title(db, titleId)
    if title is None:
        raise not_found()

    episodes = list_episodes(db, title_id=titleId, season=season)
    return {
        'title_id': titleId,
        'episodes': [
            Episode(
                id=episode.id,
                title_id=episode.title_id,
                season=episode.season,
                episode_number=episode.episode_number,
                name=episode.name,
                duration_ms=episode.duration_ms,
            )
            for episode in episodes
        ],
    }
