from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import AuthResponse, AuthUser, LoginRequest, SignupRequest
from app.db.models import User
from app.utils.security import hash_password, verify_password
from app.utils.token import create_access_token, decode_access_token


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower().strip()))


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.scalar(select(User).where(User.id == user_id))


def signup(db: Session, payload: SignupRequest) -> AuthResponse:
    user = User(
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user_id=user.id, email=user.email, name=user.name)
    return AuthResponse(
        access_token=token,
        user=AuthUser(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
    )


def login(db: Session, payload: LoginRequest) -> AuthResponse | None:
    user = get_user_by_email(db, payload.email)
    if user is None:
        return None
    if not verify_password(payload.password, user.password_hash):
        return None

    token = create_access_token(user_id=user.id, email=user.email, name=user.name)
    return AuthResponse(
        access_token=token,
        user=AuthUser(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
    )


def resolve_user_from_bearer(db: Session, authorization: str | None) -> AuthUser | None:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    payload = decode_access_token(parts[1])
    if payload is None:
        return None
    user = get_user_by_id(db, str(payload.get('sub', '')))
    if user is None:
        return None
    return AuthUser(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )

