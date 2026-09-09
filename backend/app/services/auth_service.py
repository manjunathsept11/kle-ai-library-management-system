"""Authentication: registration, login with lockout, token issue/refresh."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import as_aware, utcnow
from app.core.config import settings
from app.core.errors import AuthenticationError, ConflictError, NotFoundError
from app.core.security import (
    create_token,
    hash_password,
    hash_refresh_token,
    needs_rehash,
    new_refresh_token,
    verify_password,
)
from app.models.enums import Role, UserStatus
from app.models.user import Department, RefreshToken, User
from app.schemas.auth import RegisterRequest
from app.services import audit_service


def _now() -> datetime:
    return utcnow()


def register(db: Session, data: RegisterRequest) -> User:
    existing = db.scalar(select(User).where(User.email == data.email.lower()))
    if existing:
        raise ConflictError("An account with this email already exists")

    role = data.role if data.role in (Role.STUDENT, Role.FACULTY) else Role.STUDENT

    department_id: uuid.UUID | None = None
    if data.department_code:
        dept = db.scalar(
            select(Department).where(Department.code == data.department_code.upper())
        )
        if dept:
            department_id = dept.id

    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        role=role,
        status=UserStatus.ACTIVE,
        identifier=data.identifier,
        department_id=department_id,
    )
    db.add(user)
    db.flush()
    audit_service.record(
        db, action="user.register", actor_user_id=user.id,
        entity_type="user", entity_id=user.id, summary=f"{role.value} self-registered",
    )
    return user


def _issue_pair(db: Session, user: User, user_agent: str | None) -> tuple[str, str, int]:
    access = create_token(
        str(user.id), "access", extra={"role": user.role.value}
    )
    raw_refresh, refresh_hash = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    return access, raw_refresh, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def login(
    db: Session, email: str, password: str, *, user_agent: str | None = None
) -> tuple[User, str, str, int]:
    user = db.scalar(select(User).where(User.email == email.lower()))
    generic = AuthenticationError("Invalid email or password")
    if user is None:
        raise generic

    if user.locked_until and as_aware(user.locked_until) > _now():
        raise AuthenticationError(
            "Account temporarily locked due to failed logins. Try again later."
        )

    if not verify_password(password, user.password_hash):
        user.failed_login_count += 1
        if user.failed_login_count >= settings.MAX_FAILED_LOGINS:
            user.locked_until = _now() + timedelta(minutes=settings.ACCOUNT_LOCK_MINUTES)
            user.failed_login_count = 0
            audit_service.record(
                db, action="auth.lockout", actor_user_id=user.id,
                entity_type="user", entity_id=user.id,
                summary="Account locked after repeated failed logins",
            )
        db.flush()
        raise generic

    if user.status == UserStatus.SUSPENDED:
        raise AuthenticationError("This account is suspended. Contact the library.")

    # Success.
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = _now()
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    access, raw_refresh, expires_in = _issue_pair(db, user, user_agent)
    audit_service.record(
        db, action="auth.login", actor_user_id=user.id,
        entity_type="user", entity_id=user.id,
    )
    db.flush()
    return user, access, raw_refresh, expires_in


def refresh(
    db: Session, raw_refresh: str, *, user_agent: str | None = None
) -> tuple[User, str, str, int]:
    token_hash = hash_refresh_token(raw_refresh)
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if row is None or row.revoked_at is not None or as_aware(row.expires_at) <= _now():
        raise AuthenticationError("Refresh token is invalid or expired")

    user = db.get(User, row.user_id)
    if user is None or user.status == UserStatus.SUSPENDED:
        raise AuthenticationError("Account is not active")

    # Rotate: revoke the old token, issue a new pair.
    row.revoked_at = _now()
    access, new_raw, expires_in = _issue_pair(db, user, user_agent)
    db.flush()
    return user, access, new_raw, expires_in


def logout(db: Session, raw_refresh: str) -> None:
    row = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(raw_refresh)
        )
    )
    if row and row.revoked_at is None:
        row.revoked_at = _now()
        db.flush()


def change_password(
    db: Session, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AuthenticationError("Current password is incorrect")
    user.password_hash = hash_password(new_password)
    # Revoke all refresh tokens on password change.
    for row in db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
    ):
        row.revoked_at = _now()
    audit_service.record(
        db, action="auth.password_change", actor_user_id=user.id,
        entity_type="user", entity_id=user.id,
    )
    db.flush()


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user
