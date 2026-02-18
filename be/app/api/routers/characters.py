from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.errors import not_found
from app.api.schemas import CharacterCardResponse, ResolveEntityRequest, ResolveEntityResponse
from app.services.character_service import get_character_card
from app.services.resolve_service import resolve_entity

router = APIRouter(tags=['Characters'])


@router.get('/characters/{characterId}', response_model=CharacterCardResponse)
def read_character(
    characterId: str,
    episode_id: str,
    current_time_ms: int = Query(ge=0),
    db: Session = Depends(get_db),
):
    response = get_character_card(db, character_id=characterId, episode_id=episode_id, current_time_ms=current_time_ms)
    if response is None:
        raise not_found()
    return response


@router.post('/resolve-entity', response_model=ResolveEntityResponse)
def post_resolve_entity(payload: ResolveEntityRequest, db: Session = Depends(get_db)):
    return resolve_entity(db, payload)
