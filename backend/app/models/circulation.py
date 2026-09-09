"""Circulation: loans (issues/returns/renewals) and fines."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey
from app.models.enums import FineStatus, FineType, LoanStatus, str_enum


class Loan(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "loans"
    __table_args__ = (
        Index("ix_loans_user_status", "user_id", "status"),
        Index("ix_loans_due", "due_at"),
    )

    copy_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("book_copies.id", ondelete="RESTRICT"), index=True
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("books.id", ondelete="RESTRICT"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    issued_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    returned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now()
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    renewed_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[LoanStatus] = mapped_column(
        str_enum(LoanStatus, "loan_status"), default=LoanStatus.ACTIVE
    )

    copy: Mapped[BookCopy] = relationship()  # noqa: F821
    book: Mapped[Book] = relationship()  # noqa: F821
    fines: Mapped[list[Fine]] = relationship(back_populates="loan")


class Fine(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "fines"
    __table_args__ = (Index("ix_fines_user_status", "user_id", "status"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    loan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("loans.id", ondelete="SET NULL")
    )
    type: Mapped[FineType] = mapped_column(str_enum(FineType, "fine_type"))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    paid_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[FineStatus] = mapped_column(
        str_enum(FineStatus, "fine_status"), default=FineStatus.UNPAID
    )
    reason: Mapped[str | None] = mapped_column(Text)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    loan: Mapped[Loan | None] = relationship(back_populates="fines")

    @property
    def outstanding(self) -> float:
        return max(float(self.amount) - float(self.paid_amount), 0.0)


class FinePayment(UUIDPrimaryKey, Base):
    __tablename__ = "fine_payments"

    fine_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("fines.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    method: Mapped[str] = mapped_column(String(30), default="cash")
    note: Mapped[str | None] = mapped_column(String(200))
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now()
    )
