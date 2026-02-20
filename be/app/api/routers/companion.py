from __future__ import annotations

import json
import threading
from queue import Queue

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
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
from app.db.session import SessionLocal
from app.services.qa_service import ask_question, clear_chat_history, list_chat_history
from app.services.recap_service import build_recap

router = APIRouter(tags=['Companion'])


def _sse(event: str, payload: dict) -> str:
    return f'event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n'


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


@router.post('/qa/stream')
def create_qa_stream(
    payload: QARequest,
    user: AuthUser | None = Depends(get_optional_user),
):
    event_queue: Queue[str | None] = Queue()

    def push_status(message: str):
        if message:
            event_queue.put(_sse('status', {'message': message}))

    def push_token(token: str):
        if token:
            event_queue.put(_sse('token', {'token': token}))

    def worker():
        db = SessionLocal()
        try:
            response = ask_question(
                db,
                payload,
                user_id=user.id if user else None,
                stream_callback=push_token,
                status_callback=push_status,
            )
            event_queue.put(_sse('done', {'response': response.model_dump(mode='json')}))
        except Exception as exc:
            event_queue.put(_sse('error', {'message': str(exc)}))
        finally:
            db.close()
            event_queue.put(None)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    def event_stream():
        while True:
            item = event_queue.get()
            if item is None:
                break
            yield item

    return StreamingResponse(
        event_stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )


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
