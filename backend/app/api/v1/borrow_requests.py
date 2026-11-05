"""Borrow requests: members ask, librarians approve or reject."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.db.session import get_db
from app.models.enums import BorrowRequestStatus
from app.models.user import User
from app.schemas.catalog import BookSummary
from app.schemas.common import ORMModel, Page
from app.services import borrow_request_service as svc

router = APIRouter(tags=["borrow-requests"])


class BorrowRequestIn(BaseModel):
    book_id: uuid.UUID
    note: str | None = None


class DecisionIn(BaseModel):
    reason: str | None = None


class BorrowRequestOut(ORMModel):
    id: uuid.UUID
    book_id: uuid.UUID
    user_id: uuid.UUID
    status: BorrowRequestStatus
    note: str | None
    decision_note: str | None
    decided_at: datetime | None
    created_at: datetime
    book: BookSummary
    member_name: str | None = None
    member_identifier: str | None = None


def _out(r) -> BorrowRequestOut:
    out = BorrowRequestOut.model_validate(r)
    out.member_name, out.member_identifier = r.user.full_name, r.user.identifier
    return out


@router.post("/borrow-requests", response_model=BorrowRequestOut, status_code=201)
def create(
    data: BorrowRequestIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = svc.request(db, data.book_id, user, data.note)
    db.commit()
    return _out(req)


@router.get("/me/borrow-requests", response_model=list[BorrowRequestOut])
def mine(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [_out(r) for r in svc.list_for_user(db, user.id)]


@router.delete("/borrow-requests/{request_id}", response_model=BorrowRequestOut)
def cancel(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = svc.cancel(db, request_id, user)
    db.commit()
    return _out(req)


@router.get("/borrow-requests", response_model=Page[BorrowRequestOut])
def list_all(
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
    status: BorrowRequestStatus | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    rows, total = svc.list_all(db, status=status, page=page, page_size=page_size)
    return Page[BorrowRequestOut](
        items=[_out(r) for r in rows], total=total, page=page, page_size=page_size
    )


@router.post("/borrow-requests/{request_id}/approve", response_model=BorrowRequestOut)
def approve(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
):
    req = svc.approve(db, request_id, staff)
    db.commit()
    return _out(req)


@router.post("/borrow-requests/{request_id}/reject", response_model=BorrowRequestOut)
def reject(
    request_id: uuid.UUID,
    data: DecisionIn,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
):
    req = svc.reject(db, request_id, staff, data.reason)
    db.commit()
    return _out(req)
