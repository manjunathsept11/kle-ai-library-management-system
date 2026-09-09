"""Dashboards and reports."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles, require_staff
from app.db.session import get_db
from app.models.enums import Role
from app.models.user import User
from app.services import stats_service

router = APIRouter(tags=["reports"])


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict[str, Any]:
    if user.role == Role.ADMIN:
        return {"role": "admin", **stats_service.admin_dashboard(db)}
    if user.role == Role.LIBRARIAN:
        return {"role": "librarian", **stats_service.librarian_dashboard(db)}
    return {"role": user.role.value, **stats_service.member_dashboard(db, user)}


@router.get("/reports/most-borrowed")
def most_borrowed(
    days: int | None = Query(default=None, ge=1, le=3650),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> dict[str, Any]:
    return {"items": stats_service.most_borrowed(db, days=days, limit=limit)}


@router.get("/reports/inventory")
def inventory(
    db: Session = Depends(get_db), _: User = Depends(require_staff)
) -> dict[str, Any]:
    return stats_service.inventory_report(db)


@router.get("/reports/overdue")
def overdue(
    db: Session = Depends(get_db), _: User = Depends(require_staff)
) -> dict[str, Any]:
    return {"items": stats_service.overdue_report(db)}


@router.get("/reports/circulation")
def circulation(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.ADMIN, Role.LIBRARIAN)),
) -> dict[str, Any]:
    return stats_service.circulation_summary(db, days=days)
