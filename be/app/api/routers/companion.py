from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.schemas import QARequest, QAResponse, RecapRequest, RecapResponse
from app.services.qa_service import ask_question
from app.services.recap_service import build_recap

router = APIRouter(tags=['Companion'])


@router.post('/recap', response_model=RecapResponse)
def create_recap(payload: RecapRequest, db: Session = Depends(get_db)):
    return build_recap(db, payload)


@router.post('/qa', response_model=QAResponse)
def create_qa(payload: QARequest, db: Session = Depends(get_db)):
    return ask_question(db, payload)
