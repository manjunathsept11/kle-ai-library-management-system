"""Admin schemas: user management, departments, settings, audit."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import Role, UserStatus
from app.schemas.common import ORMModel


class DepartmentOut(ORMModel):
    id: uuid.UUID
    name: str
    code: str


class DepartmentIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=20)


class AdminUserOut(ORMModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: Role
    status: UserStatus
    identifier: str | None
    phone: str | None
    department_id: uuid.UUID | None
    email_verified: bool
    borrow_limit_override: int | None
    staff_notes: str | None
    failed_login_count: int
    locked_until: datetime | None
    last_login_at: datetime | None
    created_at: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    role: Role
    password: str = Field(min_length=8, max_length=128)
    identifier: str | None = Field(default=None, max_length=60)
    department_id: uuid.UUID | None = None
    phone: str | None = Field(default=None, max_length=30)


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    role: Role | None = None
    status: UserStatus | None = None
    department_id: uuid.UUID | None = None
    phone: str | None = None
    identifier: str | None = None
    borrow_limit_override: int | None = Field(default=None, ge=0, le=100)
    staff_notes: str | None = None
    # marks which optional fields were explicitly sent
    model_config = {"extra": "forbid"}


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class SettingsOut(BaseModel):
    values: dict[str, Any]


class SettingUpdate(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    value: Any


class AuditLogOut(ORMModel):
    id: uuid.UUID
    actor_user_id: uuid.UUID | None
    action: str
    entity_type: str | None
    entity_id: str | None
    summary: str | None
    ip_address: str | None
    request_id: str | None
    created_at: datetime
