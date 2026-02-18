from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.errors import not_found
from app.api.schemas import GraphResponse, RelationDetailResponse, RelationType
from app.services.graph_service import get_graph, get_relation_detail

router = APIRouter(tags=['Graph'])


@router.get('/graph', response_model=GraphResponse)
def read_graph(
    title_id: str,
    episode_id: str,
    current_time_ms: int = Query(ge=0),
    focus_character_id: str | None = None,
    relation_types: list[RelationType] | None = Query(default=None),
    include_hypothesis: bool = True,
    db: Session = Depends(get_db),
):
    return get_graph(
        db,
        title_id=title_id,
        episode_id=episode_id,
        current_time_ms=current_time_ms,
        focus_character_id=focus_character_id,
        relation_types=relation_types,
        include_hypothesis=include_hypothesis,
    )


@router.get('/relations/{relationId}', response_model=RelationDetailResponse)
def read_relation(relationId: str, current_time_ms: int = Query(ge=0), db: Session = Depends(get_db)):
    response = get_relation_detail(db, relation_id=relationId, current_time_ms=current_time_ms)
    if response is None:
        raise not_found()
    return response
