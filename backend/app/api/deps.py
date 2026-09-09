"""Shared FastAPI dependencies: current user, role guards."""

from __future__ import annotations

import uuid
from collections.abc import Iterable

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError, PermissionError_
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import Role, UserStatus
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or not creds.credentials:
        raise AuthenticationError("Authentication required")
    try:
        payload = decode_token(creds.credentials, expected_type="access")
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Access token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid access token") from exc

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise AuthenticationError("Malformed token subject") from exc

    user = db.get(User, user_id)
    if user is None:
        raise AuthenticationError("Account no longer exists")
    if user.status == UserStatus.SUSPENDED:
        raise PermissionError_("This account is suspended")

    request.state.user_id = str(user.id)
    return user


def require_roles(*roles: Role):
    allowed: set[Role] = set(roles)

    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise PermissionError_(
                "This action requires one of: " + ", ".join(r.value for r in allowed)
            )
        return user

    return _guard


def require_staff(user: User = Depends(get_current_user)) -> User:
    if not user.is_staff:
        raise PermissionError_("Library staff access required")
    return user


def optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if creds is None or not creds.credentials:
        return None
    try:
        payload = decode_token(creds.credentials, expected_type="access")
        return db.get(User, uuid.UUID(payload["sub"]))
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None


def roles_csv(roles: Iterable[Role]) -> str:
    return ",".join(r.value for r in roles)
