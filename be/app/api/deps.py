from collections.abc import Generator

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.api.errors import unauthorized
from app.api.schemas import AuthUser
from app.db.session import SessionLocal
from app.services.auth_service import resolve_user_from_bearer


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthUser:
    user = resolve_user_from_bearer(db, authorization)
    if user is None:
        raise unauthorized('Invalid or expired token.')
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthUser | None:
    return resolve_user_from_bearer(db, authorization)


def get_admin_user(
    user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    if not user.is_admin:
        raise unauthorized('Admin access required.')
    return user
