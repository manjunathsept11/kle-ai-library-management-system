"""Reservations and the hold queue."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.db.session import get_db
from app.models.enums import ReservationStatus
from app.models.user import User
from app.schemas.catalog import BookSummary
from app.schemas.common import Message, Page
from app.schemas.engagement import (
    ReservationCreate,
    ReservationDetail,
    ReservationOut,
)
from app.services import reservation_service

router = APIRouter(tags=["reservations"])


def _detail(r) -> ReservationDetail:
    return ReservationDetail(
        id=r.id, book_id=r.book_id, user_id=r.user_id, status=r.status,
        queue_position=r.queue_position, ready_at=r.ready_at,
        expires_at=r.expires_at, created_at=r.created_at,
        book=BookSummary.model_validate(r.book),
    )


@router.get("/me/reservations", response_model=list[ReservationDetail])
def my_reservations(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[ReservationDetail]:
    return [_detail(r) for r in reservation_service.list_for_user(db, user.id)]


@router.post("/reservations", response_model=ReservationOut, status_code=201)
def place_reservation(
    data: ReservationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReservationOut:
    res = reservation_service.place(db, data.book_id, user)
    db.commit()
    db.refresh(res)
    return ReservationOut.model_validate(res)


@router.delete("/reservations/{reservation_id}", response_model=Message)
def cancel_reservation(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Message:
    reservation_service.cancel(db, reservation_id, user)
    db.commit()
    return Message(message="Reservation cancelled")


@router.get("/reservations", response_model=Page[ReservationDetail])
def list_reservations(
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
    status: ReservationStatus | None = None,
    book_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> Page[ReservationDetail]:
    rows, total = reservation_service.list_all(
        db, status=status, book_id=book_id, page=page, page_size=page_size
    )
    return Page[ReservationDetail](
        items=[_detail(r) for r in rows],
        total=total, page=page, page_size=page_size,
    )
