"""Administrator console: users, departments, settings, audit log."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.enums import Role, UserStatus
from app.models.user import User
from app.schemas.admin import (
    AdminPasswordReset,
    AdminUserCreate,
    AdminUserOut,
    AdminUserUpdate,
    AuditLogOut,
    DepartmentIn,
    DepartmentOut,
    SettingsOut,
    SettingUpdate,
)
from app.schemas.common import Message, Page
from app.services import settings_service, user_admin_service

router = APIRouter(prefix="/admin", tags=["admin"])

_admin = require_roles(Role.ADMIN)


# --- users ---------------------------------------------------------

@router.get("/users", response_model=Page[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
    q: str | None = None,
    role: Role | None = None,
    status: UserStatus | None = None,
    department_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> Page[AdminUserOut]:
    users, total = user_admin_service.list_users(
        db, q=q, role=role, status=status, department_id=department_id,
        page=page, page_size=page_size,
    )
    return Page[AdminUserOut](
        items=[AdminUserOut.model_validate(u) for u in users],
        total=total, page=page, page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(
    user_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(_admin)
) -> AdminUserOut:
    return AdminUserOut.model_validate(user_admin_service.get(db, user_id))


@router.post("/users", response_model=AdminUserOut, status_code=201)
def create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_admin),
) -> AdminUserOut:
    user = user_admin_service.create_user(
        db, email=data.email, full_name=data.full_name, role=data.role,
        password=data.password, identifier=data.identifier,
        department_id=data.department_id, phone=data.phone, actor_id=admin.id,
    )
    db.commit()
    return AdminUserOut.model_validate(user)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_admin),
) -> AdminUserOut:
    sent = data.model_dump(exclude_unset=True)
    user = user_admin_service.update_user(
        db, user_id, actor=admin,
        full_name=sent.get("full_name"),
        role=sent.get("role"),
        status=sent.get("status"),
        department_id=sent.get("department_id", ...),
        phone=sent.get("phone", ...),
        identifier=sent.get("identifier", ...),
        borrow_limit_override=(
            sent.get("borrow_limit_override", ...)
        ),
        staff_notes=sent.get("staff_notes", ...),
    )
    db.commit()
    return AdminUserOut.model_validate(user)


@router.post("/users/{user_id}/reset-password", response_model=Message)
def reset_password(
    user_id: uuid.UUID,
    data: AdminPasswordReset,
    db: Session = Depends(get_db),
    admin: User = Depends(_admin),
) -> Message:
    user_admin_service.reset_password(db, user_id, data.new_password, admin.id)
    db.commit()
    return Message(message="Password reset. The member must sign in again.")


# --- departments -------------------------------------------------

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db), _: User = Depends(_admin)
) -> list[DepartmentOut]:
    return [
        DepartmentOut.model_validate(d)
        for d in user_admin_service.list_departments(db)
    ]


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(
    data: DepartmentIn, db: Session = Depends(get_db), admin: User = Depends(_admin)
) -> DepartmentOut:
    dept = user_admin_service.create_department(
        db, name=data.name, code=data.code, actor_id=admin.id
    )
    db.commit()
    return DepartmentOut.model_validate(dept)


@router.patch("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: uuid.UUID,
    data: DepartmentIn,
    db: Session = Depends(get_db),
    admin: User = Depends(_admin),
) -> DepartmentOut:
    dept = user_admin_service.update_department(
        db, dept_id, name=data.name, code=data.code, actor_id=admin.id
    )
    db.commit()
    return DepartmentOut.model_validate(dept)


@router.delete("/departments/{dept_id}", response_model=Message)
def delete_department(
    dept_id: uuid.UUID, db: Session = Depends(get_db), admin: User = Depends(_admin)
) -> Message:
    user_admin_service.delete_department(db, dept_id, admin.id)
    db.commit()
    return Message(message="Department deleted")


# --- settings ---------------------------------------------------

@router.get("/settings", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db), _: User = Depends(_admin)
) -> SettingsOut:
    return SettingsOut(values=settings_service.get_all(db))


@router.put("/settings", response_model=SettingsOut)
def update_setting(
    data: SettingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_admin),
) -> SettingsOut:
    from app.services import audit_service

    if data.key not in settings_service.DEFAULTS:
        raise NotFoundError(f"Unknown setting '{data.key}'")
    settings_service.set_value(db, data.key, data.value)
    audit_service.record(
        db, action="admin.settings.update", actor_user_id=admin.id,
        entity_type="setting", entity_id=data.key,
        summary=f"{data.key} = {data.value}",
    )
    db.commit()
    return SettingsOut(values=settings_service.get_all(db))


# --- audit log ------------------------------------------------

@router.get("/audit", response_model=Page[AuditLogOut])
def audit_log(
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
    action: str | None = None,
    actor_user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(40, ge=1, le=200),
) -> Page[AuditLogOut]:
    from sqlalchemy import func

    stmt = select(AuditLog)
    count = select(func.count(AuditLog.id))
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
        count = count.where(AuditLog.action.like(f"{action}%"))
    if actor_user_id:
        stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
        count = count.where(AuditLog.actor_user_id == actor_user_id)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
        count = count.where(AuditLog.entity_type == entity_type)
    total = db.scalar(count) or 0
    stmt = (
        stmt.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return Page[AuditLogOut](
        items=[AuditLogOut.model_validate(r) for r in db.scalars(stmt)],
        total=total, page=page, page_size=page_size,
    )
