"""Aggregated statistics for dashboards and reports."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models.ai import SearchLog
from app.models.catalog import Book, BookCopy, Category
from app.models.circulation import Fine, Loan, Reservation
from app.models.enums import (
    BookStatus,
    CopyStatus,
    FineStatus,
    LoanStatus,
    ReservationStatus,
    UserStatus,
)
from app.models.user import User


def _count(db: Session, stmt) -> int:
    return db.scalar(stmt) or 0


def librarian_dashboard(db: Session) -> dict[str, Any]:
    total_titles = _count(
        db, select(func.count(Book.id)).where(Book.status == BookStatus.ACTIVE)
    )
    total_copies = _count(
        db,
        select(func.count(BookCopy.id)).where(
            BookCopy.status != CopyStatus.ARCHIVED
        ),
    )
    available = _count(
        db,
        select(func.count(BookCopy.id)).where(
            BookCopy.status == CopyStatus.AVAILABLE
        ),
    )
    active_loans = _count(
        db,
        select(func.count(Loan.id)).where(
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.OVERDUE])
        ),
    )
    overdue = _count(
        db,
        select(func.count(Loan.id)).where(Loan.status == LoanStatus.OVERDUE),
    )
    ready_res = _count(
        db,
        select(func.count(Reservation.id)).where(
            Reservation.status == ReservationStatus.READY
        ),
    )
    pending_res = _count(
        db,
        select(func.count(Reservation.id)).where(
            Reservation.status == ReservationStatus.PENDING
        ),
    )
    unpaid_fines = db.scalar(
        select(func.coalesce(func.sum(Fine.amount - Fine.paid_amount), 0)).where(
            Fine.status.in_([FineStatus.UNPAID, FineStatus.PARTIAL])
        )
    ) or 0

    week_ago = utcnow().replace(tzinfo=None) - timedelta(days=7)
    issued_7d = _count(
        db, select(func.count(Loan.id)).where(Loan.issued_at >= week_ago)
    )
    returned_7d = _count(
        db, select(func.count(Loan.id)).where(Loan.returned_at >= week_ago)
    )

    popular = db.execute(
        select(Book.id, Book.title, func.count(Loan.id).label("n"))
        .join(Loan, Loan.book_id == Book.id)
        .group_by(Book.id, Book.title)
        .order_by(func.count(Loan.id).desc())
        .limit(6)
    ).all()

    return {
        "total_titles": total_titles,
        "total_copies": total_copies,
        "available_copies": available,
        "active_loans": active_loans,
        "overdue_loans": overdue,
        "reservations_ready": ready_res,
        "reservations_pending": pending_res,
        "unpaid_fines_total": round(float(unpaid_fines), 2),
        "issued_last_7d": issued_7d,
        "returned_last_7d": returned_7d,
        "popular_books": [
            {"id": str(r[0]), "title": r[1], "loans": r[2]} for r in popular
        ],
    }


def admin_dashboard(db: Session) -> dict[str, Any]:
    base = librarian_dashboard(db)
    total_users = _count(db, select(func.count(User.id)))
    by_role = dict(
        db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all()
    )
    suspended = _count(
        db,
        select(func.count(User.id)).where(User.status == UserStatus.SUSPENDED),
    )
    day_ago = utcnow().replace(tzinfo=None) - timedelta(days=1)
    logins_24h = _count(
        db, select(func.count(User.id)).where(User.last_login_at >= day_ago)
    )
    searches_7d = _count(
        db,
        select(func.count(SearchLog.id)).where(
            SearchLog.created_at
            >= (utcnow().replace(tzinfo=None) - timedelta(days=7))
        ),
    )
    failed_searches = _count(
        db,
        select(func.count(SearchLog.id)).where(SearchLog.result_count == 0),
    )
    by_dept = db.execute(
        select(Category.name, func.count(Loan.id))
        .select_from(Loan)
        .join(Book, Book.id == Loan.book_id)
        .join(Category, Category.id == Book.category_id)
        .group_by(Category.name)
        .order_by(func.count(Loan.id).desc())
        .limit(8)
    ).all()

    return {
        **base,
        "total_users": total_users,
        "users_by_role": {
            (k.value if hasattr(k, "value") else k): v for k, v in by_role.items()
        },
        "suspended_users": suspended,
        "logins_24h": logins_24h,
        "searches_last_7d": searches_7d,
        "failed_searches_total": failed_searches,
        "loans_by_category": [
            {"category": r[0], "loans": r[1]} for r in by_dept
        ],
    }


def member_dashboard(db: Session, user: User) -> dict[str, Any]:
    from app.services import circulation_service

    status = circulation_service.borrowing_status(db, user)
    due_soon = db.scalars(
        select(Loan)
        .where(
            Loan.user_id == user.id,
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.OVERDUE]),
        )
        .order_by(Loan.due_at)
        .limit(5)
    ).all()
    reservations = _count(
        db,
        select(func.count(Reservation.id)).where(
            Reservation.user_id == user.id,
            Reservation.status.in_(
                [ReservationStatus.PENDING, ReservationStatus.READY]
            ),
        ),
    )
    history_count = _count(
        db,
        select(func.count(Loan.id)).where(Loan.user_id == user.id),
    )
    return {
        **status,
        "reservations_active": reservations,
        "loans_all_time": history_count,
        "due_soon": [
            {
                "id": str(loan.id),
                "book_id": str(loan.book_id),
                "title": loan.book.title,
                "due_at": loan.due_at.isoformat(),
                "status": loan.status.value,
            }
            for loan in due_soon
        ],
    }


# --- reports -----------------------------------------------------------

def most_borrowed(db: Session, *, days: int | None = None, limit: int = 20) -> list[dict]:
    stmt = (
        select(
            Book.id,
            Book.title,
            func.count(Loan.id).label("loans"),
        )
        .join(Loan, Loan.book_id == Book.id)
        .group_by(Book.id, Book.title)
        .order_by(func.count(Loan.id).desc())
        .limit(limit)
    )
    if days:
        cutoff = utcnow().replace(tzinfo=None) - timedelta(days=days)
        stmt = stmt.where(Loan.issued_at >= cutoff)
    return [
        {"book_id": str(r[0]), "title": r[1], "loans": r[2]}
        for r in db.execute(stmt).all()
    ]


def inventory_report(db: Session) -> dict[str, Any]:
    by_status = dict(
        db.execute(
            select(BookCopy.status, func.count(BookCopy.id)).group_by(BookCopy.status)
        ).all()
    )
    by_category = db.execute(
        select(Category.name, func.count(Book.id), func.count(BookCopy.id))
        .select_from(Book)
        .join(Category, Category.id == Book.category_id, isouter=True)
        .join(BookCopy, BookCopy.book_id == Book.id, isouter=True)
        .group_by(Category.name)
        .order_by(func.count(BookCopy.id).desc())
    ).all()
    return {
        "copies_by_status": {
            (k.value if hasattr(k, "value") else k): v for k, v in by_status.items()
        },
        "by_category": [
            {"category": r[0] or "Uncategorised", "titles": r[1], "copies": r[2]}
            for r in by_category
        ],
    }


def overdue_report(db: Session) -> list[dict]:
    rows = db.scalars(
        select(Loan)
        .where(Loan.status == LoanStatus.OVERDUE)
        .order_by(Loan.due_at)
    ).all()
    out = []
    for loan in rows:
        member = db.get(User, loan.user_id)
        out.append(
            {
                "loan_id": str(loan.id),
                "book": loan.book.title,
                "member": member.full_name if member else "—",
                "member_id": str(loan.user_id),
                "due_at": loan.due_at.isoformat(),
                "days_overdue": (utcnow().date() - loan.due_at.date()).days,
            }
        )
    return out


def circulation_summary(db: Session, *, days: int = 30) -> dict[str, Any]:
    cutoff = utcnow().replace(tzinfo=None) - timedelta(days=days)
    issued = _count(
        db, select(func.count(Loan.id)).where(Loan.issued_at >= cutoff)
    )
    returned = _count(
        db, select(func.count(Loan.id)).where(Loan.returned_at >= cutoff)
    )
    renewals = db.scalar(
        select(func.coalesce(func.sum(Loan.renewed_count), 0)).where(
            Loan.issued_at >= cutoff
        )
    ) or 0
    fines_raised = db.scalar(
        select(func.coalesce(func.sum(Fine.amount), 0)).where(
            Fine.created_at >= cutoff
        )
    ) or 0
    fines_collected = db.scalar(
        select(func.coalesce(func.sum(Fine.paid_amount), 0)).where(
            Fine.created_at >= cutoff
        )
    ) or 0
    return {
        "window_days": days,
        "issued": issued,
        "returned": returned,
        "renewals": int(renewals),
        "fines_raised": round(float(fines_raised), 2),
        "fines_collected": round(float(fines_collected), 2),
    }
