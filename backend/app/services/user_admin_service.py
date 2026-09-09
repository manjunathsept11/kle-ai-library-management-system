"""Administrative user management (admin only)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.enums import Role, UserStatus
from app.models.user import Department, RefreshToken, User
from app.services import audit_service


def list_users(
    db: Session,
    *,
    q: str | None = None,
    role: Role | None = None,
    status: UserStatus | None = None,
    department_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[User], int]:
    stmt = select(User)
    count = select(func.count(User.id))
    conds = []
    if q:
        like = f"%{q.lower()}%"
        conds.append(
            or_(
                func.lower(User.full_name).like(like),
                func.lower(User.email).like(like),
                func.lower(func.coalesce(User.identifier, "")).like(like),
            )
        )
    if role:
        conds.append(User.role == role)
    if status:
        conds.append(User.status == status)
    if department_id:
        conds.append(User.department_id == department_id)
    for c in conds:
        stmt = stmt.where(c)
        count = count.where(c)
    total = db.scalar(count) or 0
    stmt = (
        stmt.order_by(User.full_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(db.scalars(stmt)), total


def get(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


def create_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    role: Role,
    password: str,
    identifier: str | None,
    department_id: uuid.UUID | None,
    phone: str | None,
    actor_id: uuid.UUID,
) -> User:
    if db.scalar(select(User).where(User.email == email.lower())):
        raise ConflictError("Email already registered")
    if department_id and db.get(Department, department_id) is None:
        raise NotFoundError("Department not found")
    user = User(
        email=email.lower(),
        full_name=full_name.strip(),
        role=role,
        status=UserStatus.ACTIVE,
        password_hash=hash_password(password),
        identifier=identifier,
        department_id=department_id,
        phone=phone,
        email_verified=True,
    )
    db.add(user)
    db.flush()
    audit_service.record(
        db, action="admin.user.create", actor_user_id=actor_id,
        entity_type="user", entity_id=user.id,
        summary=f"Created {role.value} {user.email}",
    )
    return user


def update_user(
    db: Session,
    user_id: uuid.UUID,
    *,
    actor: User,
    full_name: str | None = None,
    role: Role | None = None,
    status: UserStatus | None = None,
    department_id: uuid.UUID | None = ...,  # sentinel: ... means "not provided"
    phone: str | None = ...,
    identifier: str | None = ...,
    borrow_limit_override: int | None = ...,
    staff_notes: str | None = ...,
) -> User:
    user = get(db, user_id)

    if user.id == actor.id and role is not None and role != user.role:
        raise BusinessRuleError("You cannot change your own role")

    changes: list[str] = []
    if full_name is not None:
        user.full_name = full_name.strip()
        changes.append("name")
    if role is not None and role != user.role:
        user.role = role
        changes.append(f"role→{role.value}")
    if status is not None and status != user.status:
        user.status = status
        changes.append(f"status→{status.value}")
        if status == UserStatus.SUSPENDED:
            for t in db.scalars(
                select(RefreshToken).where(
                    RefreshToken.user_id == user.id,
                    RefreshToken.revoked_at.is_(None),
                )
            ):
                t.revoked_at = utcnow()
    if department_id is not ...:
        user.department_id = department_id
        changes.append("department")
    if phone is not ...:
        user.phone = phone
    if identifier is not ...:
        user.identifier = identifier
    if borrow_limit_override is not ...:
        user.borrow_limit_override = borrow_limit_override
        changes.append("borrow-limit")
    if staff_notes is not ...:
        user.staff_notes = staff_notes

    db.flush()
    audit_service.record(
        db, action="admin.user.update", actor_user_id=actor.id,
        entity_type="user", entity_id=user.id,
        summary=", ".join(changes) or "minor edit",
    )
    return user


def reset_password(
    db: Session, user_id: uuid.UUID, new_password: str, actor_id: uuid.UUID
) -> None:
    user = get(db, user_id)
    user.password_hash = hash_password(new_password)
    user.failed_login_count = 0
    user.locked_until = None
    for t in db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
    ):
        t.revoked_at = utcnow()
    db.flush()
    audit_service.record(
        db, action="admin.user.reset_password", actor_user_id=actor_id,
        entity_type="user", entity_id=user.id,
    )


# --- departments -----------------------------------------------------

def list_departments(db: Session) -> list[Department]:
    return list(db.scalars(select(Department).order_by(Department.name)))


def create_department(
    db: Session, *, name: str, code: str, actor_id: uuid.UUID
) -> Department:
    if db.scalar(select(Department).where(Department.code == code.upper())):
        raise ConflictError("Department code already exists")
    dept = Department(name=name.strip(), code=code.upper().strip())
    db.add(dept)
    db.flush()
    audit_service.record(
        db, action="admin.department.create", actor_user_id=actor_id,
        entity_type="department", entity_id=dept.id, summary=dept.name,
    )
    return dept


def update_department(
    db: Session, dept_id: uuid.UUID, *, name: str | None, code: str | None,
    actor_id: uuid.UUID,
) -> Department:
    dept = db.get(Department, dept_id)
    if dept is None:
        raise NotFoundError("Department not found")
    if name:
        dept.name = name.strip()
    if code:
        dept.code = code.upper().strip()
    db.flush()
    audit_service.record(
        db, action="admin.department.update", actor_user_id=actor_id,
        entity_type="department", entity_id=dept.id,
    )
    return dept


def delete_department(db: Session, dept_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    dept = db.get(Department, dept_id)
    if dept is None:
        raise NotFoundError("Department not found")
    in_use = db.scalar(
        select(func.count(User.id)).where(User.department_id == dept_id)
    )
    if in_use:
        raise BusinessRuleError(
            f"{in_use} user(s) are in this department; reassign them first"
        )
    db.delete(dept)
    db.flush()
    audit_service.record(
        db, action="admin.department.delete", actor_user_id=actor_id,
        entity_type="department", entity_id=dept_id,
    )
