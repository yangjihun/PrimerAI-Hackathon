from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_optional_user
from app.api.schemas import (
    AuthUser,
    ChatHistoryClearResponse,
    ChatHistoryResponse,
    QARequest,
    QAResponse,
    RecapRequest,
    RecapResponse,
)
from app.services.qa_service import ask_question, clear_chat_history, list_chat_history
from app.services.recap_service import build_recap

router = APIRouter(tags=['Companion'])


@router.post('/recap', response_model=RecapResponse)
def create_recap(payload: RecapRequest, db: Session = Depends(get_db)):
    return build_recap(db, payload)


@router.post('/qa', response_model=QAResponse)
def create_qa(
    payload: QARequest,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
):
    return ask_question(db, payload, user_id=user.id if user else None)


@router.get('/qa/history', response_model=ChatHistoryResponse)
def get_qa_history(
    title_id: str,
    episode_id: str,
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
):
    if user is None:
        return ChatHistoryResponse(items=[])
    items = list_chat_history(
        db,
        title_id=title_id,
        episode_id=episode_id,
        user_id=user.id,
        limit=limit,
    )
    return ChatHistoryResponse(items=items)


@router.delete('/qa/history', response_model=ChatHistoryClearResponse)
def delete_qa_history(
    title_id: str,
    episode_id: str,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(get_optional_user),
):
    if user is None:
        return ChatHistoryClearResponse(deleted_messages=0, deleted_sessions=0)
    deleted_messages, deleted_sessions = clear_chat_history(
        db,
        title_id=title_id,
        episode_id=episode_id,
        user_id=user.id,
    )
    return ChatHistoryClearResponse(
        deleted_messages=deleted_messages,
        deleted_sessions=deleted_sessions,
    )
