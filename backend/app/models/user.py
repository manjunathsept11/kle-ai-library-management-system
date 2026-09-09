"""User, department and refresh-token models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey
from app.models.enums import Role, UserStatus, str_enum


class Department(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(120), unique=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)

    users: Mapped[list[User]] = relationship(back_populates="department")


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_role_status", "role", "status"),)

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[Role] = mapped_column(str_enum(Role, "role"), default=Role.STUDENT)
    status: Mapped[UserStatus] = mapped_column(
        str_enum(UserStatus, "user_status"), default=UserStatus.ACTIVE
    )

    # Institutional identity (roll number for students, employee id for staff).
    identifier: Mapped[str | None] = mapped_column(String(60), unique=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL")
    )

    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_count: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Admin overrides / notes.
    borrow_limit_override: Mapped[int | None] = mapped_column(Integer)
    staff_notes: Mapped[str | None] = mapped_column(Text)

    department: Mapped[Department | None] = relationship(back_populates="users")

    @property
    def is_staff(self) -> bool:
        return self.role in (Role.LIBRARIAN, Role.ADMIN)


class RefreshToken(UUIDPrimaryKey, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship()
