"""Circulation endpoints: issue, return, renew, loan lists."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.core.errors import NotFoundError, PermissionError_
from app.db.session import get_db
from app.models.circulation import Loan
from app.models.enums import LoanStatus
from app.models.user import User
from app.schemas.circulation import (
    BorrowingStatus,
    FineOut,
    IssueRequest,
    LoanOut,
    RenewResult,
    ReturnRequest,
    ReturnResult,
)
from app.schemas.common import Page
from app.services import circulation_service

router = APIRouter(tags=["circulation"])


def _loan_out(db: Session, loan: Loan, *, with_member: bool = False) -> LoanOut:
    out = LoanOut.model_validate(loan)
    if with_member:
        member = db.get(User, loan.user_id)
        if member:
            out.member_name = member.full_name
            out.member_identifier = member.identifier
    return out


@router.post("/issues", response_model=LoanOut, status_code=201)
def issue_book(
    data: IssueRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> LoanOut:
    loan = circulation_service.issue(
        db, book_id=data.book_id, copy_id=data.copy_id,
        member_id=data.member_id, staff_id=staff.id,
    )
    db.commit()
    db.refresh(loan)
    return _loan_out(db, loan, with_member=True)


@router.post("/returns", response_model=ReturnResult)
def return_book(
    data: ReturnRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> ReturnResult:
    loan, fine = circulation_service.return_loan(
        db, loan_id=data.loan_id, copy_id=data.copy_id, staff_id=staff.id,
        condition_note=data.condition_note,
    )
    db.commit()
    db.refresh(loan)
    msg = "Returned on time."
    if fine:
        db.refresh(fine)
        msg = f"Returned late — overdue fine of {fine.amount} applied."
    return ReturnResult(
        loan=_loan_out(db, loan, with_member=True),
        fine=FineOut.model_validate(fine) if fine else None,
        message=msg,
    )


@router.post("/loans/{loan_id}/renew", response_model=RenewResult)
def renew_loan(
    loan_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RenewResult:
    existing = db.get(Loan, loan_id)
    if existing is None:
        raise NotFoundError("Loan not found")
    if existing.user_id != user.id and not user.is_staff:
        raise PermissionError_("You can only renew your own loans")
    loan = circulation_service.renew(db, loan_id=loan_id, actor_id=user.id)
    db.commit()
    db.refresh(loan)
    return RenewResult(
        loan=_loan_out(db, loan, with_member=user.is_staff),
        message=f"Renewed — new due date {loan.due_at:%d %b %Y}.",
    )


@router.get("/loans", response_model=Page[LoanOut])
def list_loans(
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
    member_id: uuid.UUID | None = None,
    status: LoanStatus | None = None,
    returned: bool | None = None,
    q: str | None = None,
    active_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> Page[LoanOut]:
    loans, total = circulation_service.list_loans(
        db, user_id=member_id, status=status, returned=returned, q=q,
        active_only=active_only, page=page, page_size=page_size,
    )
    return Page[LoanOut](
        items=[_loan_out(db, ln, with_member=True) for ln in loans],
        total=total, page=page, page_size=page_size,
    )


@router.get("/me/loans", response_model=Page[LoanOut])
def my_loans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    active_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> Page[LoanOut]:
    loans, total = circulation_service.list_loans(
        db, user_id=user.id, active_only=active_only, page=page, page_size=page_size
    )
    return Page[LoanOut](
        items=[LoanOut.model_validate(ln) for ln in loans],
        total=total, page=page, page_size=page_size,
    )


@router.get("/me/borrowing-status", response_model=BorrowingStatus)
def my_borrowing_status(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> BorrowingStatus:
    return BorrowingStatus(**circulation_service.borrowing_status(db, user))
