"""Reservations and the per-title hold queue."""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import as_aware, utcnow
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models.catalog import Book
from app.models.circulation import Reservation
from app.models.enums import CopyStatus, NotificationType, ReservationStatus
from app.models.user import User
from app.services import audit_service, notification_service, settings_service

_ACTIVE = (ReservationStatus.PENDING, ReservationStatus.READY)


def _book(db: Session, book_id: uuid.UUID) -> Book:
    book = db.scalar(
        select(Book).where(Book.id == book_id).options(selectinload(Book.copies))
    )
    if book is None:
        raise NotFoundError("Book not found")
    return book


def place(db: Session, book_id: uuid.UUID, user: User) -> Reservation:
    book = _book(db, book_id)

    existing = db.scalar(
        select(Reservation).where(
            Reservation.book_id == book_id,
            Reservation.user_id == user.id,
            Reservation.status.in_(_ACTIVE),
        )
    )
    if existing:
        raise ConflictError("You already have an active reservation for this title")

    if any(c.status == CopyStatus.AVAILABLE for c in book.copies):
        raise BusinessRuleError(
            "A copy is available now — you can borrow it at the circulation desk "
            "without a reservation."
        )

    last_pos = db.scalar(
        select(func.max(Reservation.queue_position)).where(
            Reservation.book_id == book_id,
            Reservation.status.in_(_ACTIVE),
        )
    )
    reservation = Reservation(
        book_id=book_id,
        user_id=user.id,
        status=ReservationStatus.PENDING,
        queue_position=(last_pos or 0) + 1,
    )
    db.add(reservation)
    db.flush()
    audit_service.record(
        db, action="reservation.place", actor_user_id=user.id,
        entity_type="reservation", entity_id=reservation.id, summary=book.title,
    )
    return reservation


def cancel(db: Session, reservation_id: uuid.UUID, actor: User) -> Reservation:
    res = db.get(Reservation, reservation_id)
    if res is None:
        raise NotFoundError("Reservation not found")
    if res.user_id != actor.id and not actor.is_staff:
        raise BusinessRuleError("You can only cancel your own reservations")
    if res.status not in _ACTIVE:
        raise BusinessRuleError("This reservation is no longer active")
    res.status = ReservationStatus.CANCELLED
    res.cancelled_at = utcnow()
    db.flush()
    _resequence(db, res.book_id)
    audit_service.record(
        db, action="reservation.cancel", actor_user_id=actor.id,
        entity_type="reservation", entity_id=res.id,
    )
    return res


def _resequence(db: Session, book_id: uuid.UUID) -> None:
    rows = db.scalars(
        select(Reservation)
        .where(
            Reservation.book_id == book_id,
            Reservation.status == ReservationStatus.PENDING,
        )
        .order_by(Reservation.created_at)
    ).all()
    for i, r in enumerate(rows, start=1):
        r.queue_position = i
    db.flush()


def on_copy_available(db: Session, book_id: uuid.UUID) -> Reservation | None:
    """Called when a copy is returned. Promotes the next person in the queue."""
    already_ready = db.scalar(
        select(Reservation).where(
            Reservation.book_id == book_id,
            Reservation.status == ReservationStatus.READY,
        )
    )
    if already_ready:
        return None

    nxt = db.scalar(
        select(Reservation)
        .where(
            Reservation.book_id == book_id,
            Reservation.status == ReservationStatus.PENDING,
        )
        .order_by(Reservation.queue_position, Reservation.created_at)
        .limit(1)
    )
    if nxt is None:
        return None

    hold_hours = int(settings_service.get(db, "reservation_hold_hours") or 48)
    nxt.status = ReservationStatus.READY
    nxt.ready_at = utcnow()
    nxt.expires_at = utcnow() + timedelta(hours=hold_hours)
    db.flush()

    book = db.get(Book, book_id)
    notification_service.notify(
        db,
        user_id=nxt.user_id,
        type_=NotificationType.RESERVATION_READY,
        title=f"'{book.title}' is ready for pickup",
        body=(
            f"A copy is held for you until "
            f"{nxt.expires_at:%d %b %Y %H:%M}. Collect it at the circulation desk."
        ),
        link=f"/books/{book_id}",
    )
    return nxt


def fulfilled(db: Session, book_id: uuid.UUID, user_id: uuid.UUID, loan_id: uuid.UUID) -> None:
    """Mark a READY reservation fulfilled when its owner borrows the copy."""
    res = db.scalar(
        select(Reservation).where(
            Reservation.book_id == book_id,
            Reservation.user_id == user_id,
            Reservation.status == ReservationStatus.READY,
        )
    )
    if res:
        res.status = ReservationStatus.FULFILLED
        res.fulfilled_loan_id = loan_id
        db.flush()
        _resequence(db, book_id)


def expire_stale(db: Session) -> int:
    """Worker job: expire READY reservations past their hold window."""
    now = utcnow()
    rows = db.scalars(
        select(Reservation).where(Reservation.status == ReservationStatus.READY)
    ).all()
    n = 0
    for res in rows:
        if res.expires_at and as_aware(res.expires_at) < now:
            res.status = ReservationStatus.EXPIRED
            n += 1
            book = db.get(Book, res.book_id)
            notification_service.notify(
                db, user_id=res.user_id,
                type_=NotificationType.RESERVATION_EXPIRED,
                title=f"Reservation for '{book.title}' expired",
                body="The hold window passed. You can place a new reservation.",
                link=f"/books/{res.book_id}",
            )
            db.flush()
            on_copy_available(db, res.book_id)
    return n


def list_for_user(db: Session, user_id: uuid.UUID) -> list[Reservation]:
    return list(
        db.scalars(
            select(Reservation)
            .where(Reservation.user_id == user_id)
            .options(selectinload(Reservation.book))
            .order_by(Reservation.created_at.desc())
        )
    )


def list_all(
    db: Session,
    *,
    status: ReservationStatus | None = None,
    book_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Reservation], int]:
    stmt = select(Reservation).options(selectinload(Reservation.book))
    count = select(func.count(Reservation.id))
    if status:
        stmt = stmt.where(Reservation.status == status)
        count = count.where(Reservation.status == status)
    if book_id:
        stmt = stmt.where(Reservation.book_id == book_id)
        count = count.where(Reservation.book_id == book_id)
    total = db.scalar(count) or 0
    stmt = (
        stmt.order_by(Reservation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(db.scalars(stmt)), total
