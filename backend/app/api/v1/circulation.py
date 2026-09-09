"""Circulation endpoints: issue, return, renew, my loans."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.db.session import get_db
from app.models.user import User
from app.schemas.circulation import (
    BorrowingStatus,
    FineOut,
    IssueRequest,
    LoanOut,
    ReturnRequest,
    ReturnResult,
)
from app.schemas.common import Page
from app.services import circulation_service

router = APIRouter(tags=["circulation"])


@router.post("/issues", response_model=LoanOut, status_code=201)
def issue_book(
    data: IssueRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> LoanOut:
    loan = circulation_service.issue(
        db,
        book_id=data.book_id,
        copy_id=data.copy_id,
        member_id=data.member_id,
        staff_id=staff.id,
    )
    db.commit()
    db.refresh(loan)
    return LoanOut.model_validate(loan)


@router.post("/returns", response_model=ReturnResult)
def return_book(
    data: ReturnRequest,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> ReturnResult:
    loan, fine = circulation_service.return_loan(
        db,
        loan_id=data.loan_id,
        copy_id=data.copy_id,
        staff_id=staff.id,
        condition_note=data.condition_note,
    )
    db.commit()
    db.refresh(loan)
    msg = "Returned on time."
    if fine:
        db.refresh(fine)
        msg = f"Returned {(fine.reason or '').lower()}. Overdue fine: {fine.amount}."
    return ReturnResult(
        loan=LoanOut.model_validate(loan),
        fine=FineOut.model_validate(fine) if fine else None,
        message=msg,
    )


@router.post("/loans/{loan_id}/renew", response_model=LoanOut)
def renew_loan(
    loan_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LoanOut:
    from app.core.errors import NotFoundError, PermissionError_
    from app.models.circulation import Loan

    existing = db.get(Loan, loan_id)
    if existing is None:
        raise NotFoundError("Loan not found")
    # Members may only renew their own loans; staff may renew any.
    if existing.user_id != user.id and not user.is_staff:
        raise PermissionError_("You can only renew your own loans")

    loan = circulation_service.renew(db, loan_id=loan_id, actor_id=user.id)
    db.commit()
    db.refresh(loan)
    return LoanOut.model_validate(loan)


@router.get("/loans", response_model=Page[LoanOut])
def list_loans(
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
    member_id: uuid.UUID | None = None,
    active_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[LoanOut]:
    loans, total = circulation_service.list_loans(
        db, user_id=member_id, active_only=active_only, page=page, page_size=page_size
    )
    return Page[LoanOut](
        items=[LoanOut.model_validate(loan) for loan in loans],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/me/loans", response_model=Page[LoanOut])
def my_loans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    active_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[LoanOut]:
    loans, total = circulation_service.list_loans(
        db, user_id=user.id, active_only=active_only, page=page, page_size=page_size
    )
    return Page[LoanOut](
        items=[LoanOut.model_validate(loan) for loan in loans],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/me/borrowing-status", response_model=BorrowingStatus)
def my_borrowing_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BorrowingStatus:
    return BorrowingStatus(**circulation_service.borrowing_status(db, user))
