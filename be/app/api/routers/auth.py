from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.errors import conflict, unauthorized
from app.api.schemas import AuthResponse, AuthUser, LoginRequest, SignupRequest
from app.services.auth_service import get_user_by_email, login, resolve_user_from_bearer, signup

router = APIRouter(prefix='/auth', tags=['Auth'])


@router.post('/signup', response_model=AuthResponse)
def signup_user(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    existing = get_user_by_email(db, payload.email)
    if existing is not None:
        raise conflict('Email already registered.')
    try:
        return signup(db, payload)
    except IntegrityError:
        db.rollback()
        raise conflict('Email already registered.')


@router.post('/login', response_model=AuthResponse)
def login_user(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    response = login(db, payload)
    if response is None:
        raise unauthorized('Invalid email or password.')
    return response


@router.get('/me', response_model=AuthUser)
def read_me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthUser:
    user = resolve_user_from_bearer(db, authorization)
    if user is None:
        raise unauthorized('Invalid or expired token.')
    return user

