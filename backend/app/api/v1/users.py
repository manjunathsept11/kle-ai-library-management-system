"""User lookup for library staff (issue/return workflows)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import require_staff
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserOut
from app.services import circulation_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def search_users(
    q: str = Query(min_length=1, max_length=120),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> list[User]:
    like = f"%{q.lower()}%"
    stmt = (
        select(User)
        .where(
            or_(
                func.lower(User.full_name).like(like),
                func.lower(User.email).like(like),
                func.lower(func.coalesce(User.identifier, "")).like(like),
            )
        )
        .order_by(User.full_name)
        .limit(15)
    )
    return list(db.scalars(stmt))


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


@router.get("/{user_id}/borrowing-status")
def user_borrowing_status(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return circulation_service.borrowing_status(db, user)
