"""Schemas for reservations, notifications and favorites."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import NotificationType, ReservationStatus
from app.schemas.catalog import BookSummary
from app.schemas.common import ORMModel


class ReservationOut(ORMModel):
    id: uuid.UUID
    book_id: uuid.UUID
    user_id: uuid.UUID
    status: ReservationStatus
    queue_position: int
    ready_at: datetime | None
    expires_at: datetime | None
    created_at: datetime


class ReservationDetail(ReservationOut):
    book: BookSummary


class ReservationCreate(BaseModel):
    book_id: uuid.UUID


class NotificationOut(ORMModel):
    id: uuid.UUID
    type: NotificationType
    title: str
    body: str | None
    link: str | None
    is_read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


class AnnouncementIn(BaseModel):
    title: str
    body: str | None = None
    audience: str = "all"  # all | students | faculty | staff


class FavoriteOut(BaseModel):
    book: BookSummary
    created_at: datetime
