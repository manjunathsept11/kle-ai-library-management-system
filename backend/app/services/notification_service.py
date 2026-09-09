"""In-app notifications (email delivery is a later enhancement)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.engagement import Notification
from app.models.enums import NotificationType


def notify(
    db: Session,
    *,
    user_id: uuid.UUID,
    type_: NotificationType,
    title: str,
    body: str | None = None,
    link: str | None = None,
    meta: dict[str, Any] | None = None,
) -> Notification:
    n = Notification(
        user_id=user_id, type=type_, title=title, body=body, link=link, meta=meta
    )
    db.add(n)
    db.flush()
    return n


def broadcast(
    db: Session,
    *,
    user_ids: list[uuid.UUID],
    type_: NotificationType,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> int:
    for uid in user_ids:
        db.add(
            Notification(user_id=uid, type=type_, title=title, body=body, link=link)
        )
    db.flush()
    return len(user_ids)


def list_for_user(
    db: Session, user_id: uuid.UUID, *, unread_only: bool = False, limit: int = 50
) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
    return list(db.scalars(stmt))


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id, Notification.is_read.is_(False)
            )
        )
        or 0
    )


def mark_read(db: Session, user_id: uuid.UUID, notif_id: uuid.UUID) -> None:
    db.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == user_id)
        .values(is_read=True, read_at=utcnow())
    )
    db.flush()


def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=utcnow())
    )
    db.flush()
    return result.rowcount or 0
