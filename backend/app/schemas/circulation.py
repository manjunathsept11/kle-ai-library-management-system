"""Circulation schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import FineStatus, FineType, LoanStatus
from app.schemas.common import ORMModel


class IssueRequest(BaseModel):
    member_id: uuid.UUID
    book_id: uuid.UUID | None = None
    copy_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _one_target(self) -> IssueRequest:
        if bool(self.book_id) == bool(self.copy_id):
            raise ValueError("Provide exactly one of book_id or copy_id")
        return self


class ReturnRequest(BaseModel):
    loan_id: uuid.UUID | None = None
    copy_id: uuid.UUID | None = None
    condition_note: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _one_ref(self) -> ReturnRequest:
        if bool(self.loan_id) == bool(self.copy_id):
            raise ValueError("Provide exactly one of loan_id or copy_id")
        return self


class BookRef(ORMModel):
    id: uuid.UUID
    title: str


class LoanOut(ORMModel):
    id: uuid.UUID
    book_id: uuid.UUID
    copy_id: uuid.UUID
    user_id: uuid.UUID
    issued_at: datetime
    due_at: datetime
    returned_at: datetime | None
    renewed_count: int
    status: LoanStatus
    book: BookRef
    member_name: str | None = None
    member_identifier: str | None = None


class FineOut(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    loan_id: uuid.UUID | None
    type: FineType
    amount: float
    paid_amount: float
    status: FineStatus
    reason: str | None
    created_at: datetime
    resolved_at: datetime | None = None
    member_name: str | None = None


class ReturnResult(BaseModel):
    loan: LoanOut
    fine: FineOut | None
    message: str


class BorrowingStatus(BaseModel):
    active_loans: int
    borrow_limit: int
    can_borrow: bool
    outstanding_fines: float
    fine_block_threshold: float


class FinePaymentRequest(BaseModel):
    amount: float = Field(gt=0)
    method: str = Field(default="cash", max_length=30)
    note: str | None = Field(default=None, max_length=200)


class FineWaiveRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class ManualFineRequest(BaseModel):
    member_id: uuid.UUID
    type: FineType
    amount: float = Field(gt=0)
    reason: str = Field(min_length=3, max_length=300)
    loan_id: uuid.UUID | None = None


class RenewResult(BaseModel):
    loan: LoanOut
    message: str
