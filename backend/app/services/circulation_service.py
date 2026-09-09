"""Circulation: issue, return, renew. Enforces library business rules.

Business rules (all configurable via settings_service):
  * a user cannot exceed their role's borrow limit
  * a copy cannot be on loan to two users at once
  * a user with unpaid fines over the block threshold cannot borrow
  * overdue returns create an overdue fine automatically
  * renewals are capped and blocked once a title is reserved by someone else
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import as_aware, utcnow
from app.core.errors import BusinessRuleError, NotFoundError
from app.models.catalog import BookCopy
from app.models.circulation import Fine, Loan
from app.models.enums import CopyStatus, FineStatus, FineType, LoanStatus
from app.models.user import User
from app.services import audit_service, settings_service


def _now() -> datetime:
    return utcnow()


def _active_loan_count(db: Session, user_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count(Loan.id)).where(
            Loan.user_id == user_id,
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.OVERDUE]),
        )
    ) or 0


def _outstanding_fines(db: Session, user_id: uuid.UUID) -> float:
    rows = db.scalars(
        select(Fine).where(
            Fine.user_id == user_id,
            Fine.status.in_([FineStatus.UNPAID, FineStatus.PARTIAL]),
        )
    )
    return round(sum(f.outstanding for f in rows), 2)


def borrowing_status(db: Session, user: User) -> dict:
    limit = (
        user.borrow_limit_override
        if user.borrow_limit_override is not None
        else settings_service.borrow_limit(db, user.role.value)
    )
    active = _active_loan_count(db, user.id)
    outstanding = _outstanding_fines(db, user.id)
    block_threshold = float(settings_service.get(db, "lost_book_flat_fine") or 500) / 2
    return {
        "active_loans": active,
        "borrow_limit": limit,
        "can_borrow": active < limit and outstanding <= block_threshold,
        "outstanding_fines": outstanding,
        "fine_block_threshold": block_threshold,
    }


def _find_available_copy(db: Session, book_id: uuid.UUID) -> BookCopy:
    stmt = (
        select(BookCopy)
        .where(
            BookCopy.book_id == book_id,
            BookCopy.status == CopyStatus.AVAILABLE,
        )
        .order_by(BookCopy.created_at)
        .limit(1)
    )
    # Row lock on real databases prevents a double-issue race; SQLite is
    # single-writer so it does not support (or need) SELECT ... FOR UPDATE.
    if db.bind is not None and db.bind.dialect.name != "sqlite":
        stmt = stmt.with_for_update()
    copy = db.scalar(stmt)
    if copy is None:
        raise BusinessRuleError("No copies of this book are currently available")
    return copy


def issue(
    db: Session,
    *,
    book_id: uuid.UUID | None = None,
    copy_id: uuid.UUID | None = None,
    member_id: uuid.UUID,
    staff_id: uuid.UUID | None,
) -> Loan:
    member = db.get(User, member_id)
    if member is None:
        raise NotFoundError("Member not found")

    status = borrowing_status(db, member)
    if status["active_loans"] >= status["borrow_limit"]:
        raise BusinessRuleError(
            f"{member.full_name} has reached the borrowing limit "
            f"({status['borrow_limit']})"
        )
    if not status["can_borrow"]:
        raise BusinessRuleError(
            f"{member.full_name} has outstanding fines and cannot borrow until "
            "they are cleared"
        )

    if copy_id is not None:
        copy = db.get(BookCopy, copy_id)
        if copy is None:
            raise NotFoundError("Copy not found")
        if copy.status != CopyStatus.AVAILABLE:
            raise BusinessRuleError(f"Copy {copy.barcode} is not available")
    elif book_id is not None:
        copy = _find_available_copy(db, book_id)
    else:
        raise BusinessRuleError("Provide either book_id or copy_id")

    loan_days = settings_service.loan_period_days(db, member.role.value)
    loan = Loan(
        copy_id=copy.id,
        book_id=copy.book_id,
        user_id=member.id,
        issued_by=staff_id,
        issued_at=_now(),
        due_at=_now() + timedelta(days=loan_days),
        status=LoanStatus.ACTIVE,
    )
    copy.status = CopyStatus.ISSUED
    db.add(loan)
    db.flush()

    # If this member was at the head of the reservation queue, close it out.
    from app.services import reservation_service

    reservation_service.fulfilled(db, copy.book_id, member.id, loan.id)

    audit_service.record(
        db, action="loan.issue", actor_user_id=staff_id or member.id,
        entity_type="loan", entity_id=loan.id,
        summary=f"Issued copy {copy.barcode} to {member.full_name}",
    )
    return loan


def _overdue_fine_amount(db: Session, loan: Loan, returned_at: datetime) -> float:
    grace = int(settings_service.get(db, "grace_period_days") or 0)
    per_day = float(settings_service.get(db, "overdue_fine_per_day") or 0)
    due = as_aware(loan.due_at)
    overdue_days = (returned_at.date() - due.date()).days - grace
    return round(max(overdue_days, 0) * per_day, 2)


def return_loan(
    db: Session,
    *,
    loan_id: uuid.UUID | None = None,
    copy_id: uuid.UUID | None = None,
    staff_id: uuid.UUID | None,
    condition_note: str | None = None,
) -> tuple[Loan, Fine | None]:
    loan: Loan | None = None
    if loan_id is not None:
        loan = db.get(Loan, loan_id)
    elif copy_id is not None:
        loan = db.scalar(
            select(Loan).where(
                Loan.copy_id == copy_id,
                Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.OVERDUE]),
            )
        )
    if loan is None:
        raise NotFoundError("No active loan found for that reference")
    if loan.status in (LoanStatus.RETURNED,):
        raise BusinessRuleError("This loan has already been returned")

    returned_at = _now()
    loan.returned_at = returned_at
    loan.returned_to = staff_id
    loan.status = LoanStatus.RETURNED

    copy = db.get(BookCopy, loan.copy_id)
    if copy is not None:
        copy.status = CopyStatus.AVAILABLE
        copy.last_inventory_at = returned_at
        if condition_note:
            copy.notes = condition_note

    fine: Fine | None = None
    amount = _overdue_fine_amount(db, loan, returned_at)
    if amount > 0:
        fine = Fine(
            user_id=loan.user_id,
            loan_id=loan.id,
            type=FineType.OVERDUE,
            amount=amount,
            reason=f"Overdue return ({returned_at.date()} vs due {loan.due_at.date()})",
        )
        db.add(fine)

    if fine is not None:
        from app.models.enums import NotificationType
        from app.services import notification_service

        notification_service.notify(
            db, user_id=loan.user_id, type_=NotificationType.FINE_ISSUED,
            title=f"Overdue fine: {amount}",
            body=f"An overdue fine of {amount} was added for a late return.",
            link="/fines",
        )

    db.flush()

    # Promote the next person waiting for this title.
    from app.services import reservation_service

    reservation_service.on_copy_available(db, loan.book_id)

    audit_service.record(
        db, action="loan.return", actor_user_id=staff_id or loan.user_id,
        entity_type="loan", entity_id=loan.id,
        summary=f"Returned; fine {amount}" if amount else "Returned on time",
    )
    return loan, fine


def renew(
    db: Session, *, loan_id: uuid.UUID, actor_id: uuid.UUID
) -> Loan:
    loan = db.get(Loan, loan_id)
    if loan is None:
        raise NotFoundError("Loan not found")
    if loan.status not in (LoanStatus.ACTIVE, LoanStatus.OVERDUE):
        raise BusinessRuleError("Only an active loan can be renewed")

    max_renewals = int(settings_service.get(db, "max_renewals") or 2)
    if loan.renewed_count >= max_renewals:
        raise BusinessRuleError(
            f"This loan has already been renewed {max_renewals} time(s)"
        )

    # Block renewal if someone else is waiting for the title (reservations land
    # in a later phase; the check is a no-op until then).
    extend_days = int(settings_service.get(db, "renewal_extends_days") or 7)
    current_due = as_aware(loan.due_at)
    base = current_due if current_due > _now() else _now()
    loan.due_at = base + timedelta(days=extend_days)
    loan.renewed_count += 1
    loan.status = LoanStatus.ACTIVE
    db.flush()
    audit_service.record(
        db, action="loan.renew", actor_user_id=actor_id,
        entity_type="loan", entity_id=loan.id,
        summary=f"Renewed to {loan.due_at.date()}",
    )
    return loan


def mark_overdue(db: Session) -> int:
    """Flip ACTIVE loans past their due date to OVERDUE. Run by the worker."""
    # Compare against a naive UTC value: SQLite stores naive datetimes and a
    # tz-aware bind would not order correctly against them.
    rows = db.scalars(
        select(Loan).where(
            Loan.status == LoanStatus.ACTIVE,
            Loan.due_at < _now().replace(tzinfo=None),
        )
    )
    n = 0
    for loan in rows:
        loan.status = LoanStatus.OVERDUE
        n += 1
    db.flush()
    return n


def list_loans(
    db: Session,
    *,
    user_id: uuid.UUID | None = None,
    active_only: bool = False,
    status: LoanStatus | None = None,
    returned: bool | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Loan], int]:
    from app.models.catalog import Book

    stmt = select(Loan)
    count_stmt = select(func.count(Loan.id))
    conds = []
    if user_id is not None:
        conds.append(Loan.user_id == user_id)
    if active_only:
        conds.append(Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.OVERDUE]))
    if status is not None:
        conds.append(Loan.status == status)
    if returned is True:
        conds.append(Loan.returned_at.is_not(None))
    elif returned is False:
        conds.append(Loan.returned_at.is_(None))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.join(Book, Book.id == Loan.book_id)
        count_stmt = count_stmt.join(Book, Book.id == Loan.book_id)
        conds.append(func.lower(Book.title).like(like))
    for c in conds:
        stmt = stmt.where(c)
        count_stmt = count_stmt.where(c)
    total = db.scalar(count_stmt) or 0
    order = Loan.returned_at.desc() if returned else Loan.issued_at.desc()
    stmt = stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)
    return list(db.scalars(stmt)), total


# --- fines --------------------------------------------------------------

def list_fines(
    db: Session,
    *,
    user_id: uuid.UUID | None = None,
    status: FineStatus | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Fine], int]:
    stmt = select(Fine)
    count_stmt = select(func.count(Fine.id))
    if user_id is not None:
        stmt = stmt.where(Fine.user_id == user_id)
        count_stmt = count_stmt.where(Fine.user_id == user_id)
    if status is not None:
        stmt = stmt.where(Fine.status == status)
        count_stmt = count_stmt.where(Fine.status == status)
    total = db.scalar(count_stmt) or 0
    stmt = (
        stmt.order_by(Fine.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(db.scalars(stmt)), total


def record_payment(
    db: Session,
    *,
    fine_id: uuid.UUID,
    amount: float,
    method: str,
    note: str | None,
    staff_id: uuid.UUID,
) -> Fine:
    fine = db.get(Fine, fine_id)
    if fine is None:
        raise NotFoundError("Fine not found")
    if fine.status in (FineStatus.PAID, FineStatus.WAIVED):
        raise BusinessRuleError("This fine is already settled")
    if amount <= 0:
        raise BusinessRuleError("Payment amount must be positive")
    if amount > fine.outstanding + 0.001:
        raise BusinessRuleError(
            f"Payment ({amount}) exceeds the outstanding balance ({fine.outstanding})"
        )

    from app.models.circulation import FinePayment

    db.add(
        FinePayment(
            fine_id=fine.id, amount=amount, method=method, note=note,
            recorded_by=staff_id,
        )
    )
    fine.paid_amount = round(float(fine.paid_amount) + amount, 2)
    fine.status = (
        FineStatus.PAID
        if fine.paid_amount + 0.001 >= float(fine.amount)
        else FineStatus.PARTIAL
    )
    if fine.status == FineStatus.PAID:
        fine.resolved_at = _now()
        fine.resolved_by = staff_id
    db.flush()
    audit_service.record(
        db, action="fine.payment", actor_user_id=staff_id,
        entity_type="fine", entity_id=fine.id,
        summary=f"Paid {amount} via {method}",
    )
    return fine


def waive_fine(
    db: Session, *, fine_id: uuid.UUID, reason: str, staff_id: uuid.UUID
) -> Fine:
    fine = db.get(Fine, fine_id)
    if fine is None:
        raise NotFoundError("Fine not found")
    if fine.status in (FineStatus.PAID, FineStatus.WAIVED):
        raise BusinessRuleError("This fine is already settled")
    fine.status = FineStatus.WAIVED
    fine.reason = f"{fine.reason or ''}\nWaived: {reason}".strip()
    fine.resolved_at = _now()
    fine.resolved_by = staff_id
    db.flush()
    audit_service.record(
        db, action="fine.waive", actor_user_id=staff_id,
        entity_type="fine", entity_id=fine.id, summary=reason,
    )
    return fine


def create_manual_fine(
    db: Session,
    *,
    user_id: uuid.UUID,
    fine_type: FineType,
    amount: float,
    reason: str,
    loan_id: uuid.UUID | None,
    staff_id: uuid.UUID,
) -> Fine:
    if amount <= 0:
        raise BusinessRuleError("Fine amount must be positive")
    if db.get(User, user_id) is None:
        raise NotFoundError("Member not found")
    fine = Fine(
        user_id=user_id, loan_id=loan_id, type=fine_type, amount=amount, reason=reason
    )
    db.add(fine)
    db.flush()
    audit_service.record(
        db, action="fine.create", actor_user_id=staff_id,
        entity_type="fine", entity_id=fine.id,
        summary=f"{fine_type.value} {amount}",
    )
    return fine
