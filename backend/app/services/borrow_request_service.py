"""Borrow requests: a member asks for a title, a librarian approves (issues) or rejects."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.clock import utcnow
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models.catalog import Book, BookCopy
from app.models.circulation import BorrowRequest
from app.models.enums import BorrowRequestStatus as S
from app.models.enums import CopyStatus, NotificationType, Role
from app.models.user import User
from app.services import audit_service, circulation_service, notification_service

_LOAD = (selectinload(BorrowRequest.book), selectinload(BorrowRequest.user))


def request(db: Session, book_id: uuid.UUID, user: User, note: str | None) -> BorrowRequest:
    book = db.get(Book, book_id)
    if book is None:
        raise NotFoundError("Book not found")
    if db.scalar(
        select(BorrowRequest.id).where(
            BorrowRequest.book_id == book_id,
            BorrowRequest.user_id == user.id,
            BorrowRequest.status == S.PENDING,
        )
    ):
        raise ConflictError("You already have a pending request for this title")
    has_copy = db.scalar(
        select(func.count(BookCopy.id)).where(
            BookCopy.book_id == book_id, BookCopy.status == CopyStatus.AVAILABLE
        )
    )
    if not has_copy:
        raise BusinessRuleError("No copy is available right now — reserve it instead.")
    if not circulation_service.borrowing_status(db, user)["can_borrow"]:
        raise BusinessRuleError(
            "You cannot borrow right now (loan limit reached or fines outstanding)."
        )

    req = BorrowRequest(book_id=book_id, user_id=user.id, note=(note or "").strip() or None)
    db.add(req)
    db.flush()
    audit_service.record(
        db, action="borrow_request.create", actor_user_id=user.id,
        entity_type="borrow_request", entity_id=req.id, summary=book.title,
    )
    staff = db.scalars(select(User.id).where(User.role.in_((Role.LIBRARIAN, Role.ADMIN)))).all()
    notification_service.broadcast(
        db, user_ids=list(staff), type_=NotificationType.BORROW_REQUEST,
        title=f"{user.full_name} requested '{book.title}'",
        link="/staff/requests",
    )
    return req


def _pending(db: Session, request_id: uuid.UUID) -> BorrowRequest:
    req = db.get(BorrowRequest, request_id)
    if req is None:
        raise NotFoundError("Request not found")
    if req.status != S.PENDING:
        raise BusinessRuleError(f"This request is already {req.status.value}")
    return req


def approve(db: Session, request_id: uuid.UUID, actor: User) -> BorrowRequest:
    req = _pending(db, request_id)
    # issue() enforces availability, borrow limit and fines; its error becomes the toast.
    loan = circulation_service.issue(
        db, book_id=req.book_id, member_id=req.user_id, staff_id=actor.id
    )
    req.status, req.loan_id = S.APPROVED, loan.id
    req.decided_by, req.decided_at = actor.id, utcnow()
    db.flush()
    notification_service.notify(
        db, user_id=req.user_id, type_=NotificationType.BORROW_REQUEST,
        title=f"Approved: '{req.book.title}'",
        body=f"Collect it at the circulation desk. Due {loan.due_at:%d %b %Y}.",
        link="/my-library",
    )
    audit_service.record(
        db, action="borrow_request.approve", actor_user_id=actor.id,
        entity_type="borrow_request", entity_id=req.id, summary=req.book.title,
    )
    return req


def reject(db: Session, request_id: uuid.UUID, actor: User, reason: str | None) -> BorrowRequest:
    req = _pending(db, request_id)
    req.status, req.decision_note = S.REJECTED, (reason or "").strip() or None
    req.decided_by, req.decided_at = actor.id, utcnow()
    db.flush()
    notification_service.notify(
        db, user_id=req.user_id, type_=NotificationType.BORROW_REQUEST,
        title=f"Request declined: '{req.book.title}'",
        body=req.decision_note, link="/my-library",
    )
    audit_service.record(
        db, action="borrow_request.reject", actor_user_id=actor.id,
        entity_type="borrow_request", entity_id=req.id, summary=req.book.title,
    )
    return req


def cancel(db: Session, request_id: uuid.UUID, actor: User) -> BorrowRequest:
    req = _pending(db, request_id)
    if req.user_id != actor.id:
        raise BusinessRuleError("You can only cancel your own requests")
    req.status = S.CANCELLED
    db.flush()
    return req


def list_for_user(db: Session, user_id: uuid.UUID) -> list[BorrowRequest]:
    return list(db.scalars(
        select(BorrowRequest).where(BorrowRequest.user_id == user_id)
        .options(*_LOAD).order_by(BorrowRequest.created_at.desc())
    ))


def list_all(
    db: Session, *, status: S | None, page: int, page_size: int
) -> tuple[list[BorrowRequest], int]:
    stmt, count = select(BorrowRequest).options(*_LOAD), select(func.count(BorrowRequest.id))
    if status:
        stmt = stmt.where(BorrowRequest.status == status)
        count = count.where(BorrowRequest.status == status)
    rows = db.scalars(
        stmt.order_by(BorrowRequest.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(rows), db.scalar(count) or 0
