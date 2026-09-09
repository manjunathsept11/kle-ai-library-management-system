"""Member notifications + staff announcements."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.db.session import get_db
from app.models.enums import NotificationType, Role, UserStatus
from app.models.user import User
from app.schemas.common import Message
from app.schemas.engagement import AnnouncementIn, NotificationList, NotificationOut
from app.services import notification_service

router = APIRouter(tags=["notifications"])


@router.get("/me/notifications", response_model=NotificationList)
def my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NotificationList:
    items = notification_service.list_for_user(db, user.id, unread_only=unread_only)
    return NotificationList(
        items=[NotificationOut.model_validate(n) for n in items],
        unread=notification_service.unread_count(db, user.id),
    )


@router.post("/me/notifications/{notif_id}/read", response_model=Message)
def mark_read(
    notif_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Message:
    notification_service.mark_read(db, user.id, notif_id)
    db.commit()
    return Message(message="ok")


@router.post("/me/notifications/read-all", response_model=Message)
def mark_all_read(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Message:
    n = notification_service.mark_all_read(db, user.id)
    db.commit()
    return Message(message=f"{n} marked read")


@router.post("/announcements", response_model=Message)
def announce(
    data: AnnouncementIn,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> Message:
    stmt = select(User.id).where(User.status == UserStatus.ACTIVE)
    if data.audience == "students":
        stmt = stmt.where(User.role == Role.STUDENT)
    elif data.audience == "faculty":
        stmt = stmt.where(User.role == Role.FACULTY)
    elif data.audience == "staff":
        stmt = stmt.where(User.role.in_([Role.LIBRARIAN, Role.ADMIN]))
    ids = list(db.scalars(stmt))
    n = notification_service.broadcast(
        db, user_ids=ids, type_=NotificationType.ANNOUNCEMENT,
        title=data.title, body=data.body,
    )
    from app.services import audit_service

    audit_service.record(
        db, action="announcement.send", actor_user_id=staff.id,
        summary=f"{data.title} → {n} members",
    )
    db.commit()
    return Message(message=f"Announcement sent to {n} member(s)")
