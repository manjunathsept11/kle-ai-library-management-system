"""Read/write runtime library policy with sensible defaults.

Every institutional number is here, not in code. The administrator can change
any of these; ``get(key)`` falls back to ``DEFAULTS`` when unset.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.setting import LibrarySetting

DEFAULTS: dict[str, Any] = {
    # Loan period (days) and borrowing limits per role.
    "loan_period_days": {"student": 14, "faculty": 30, "librarian": 30, "admin": 30},
    "borrow_limit": {"student": 4, "faculty": 10, "librarian": 10, "admin": 10},
    "max_renewals": 2,
    "renewal_extends_days": 7,
    "grace_period_days": 0,
    # Fines (in the institution's currency units per day / per event).
    "currency": "INR",
    "overdue_fine_per_day": 2.0,
    "lost_book_flat_fine": 500.0,
    "damage_fine": 100.0,
    # Reservations.
    "reservation_hold_hours": 48,
    # Library information surfaced by the chatbot (admin-editable, not invented).
    "library_hours": "Monday-Saturday, 9:00 AM - 8:00 PM. Closed on public holidays.",
    "contact_email": "library@kle.edu",
    # AI behaviour.
    "ai_semantic_search_enabled": True,
    "ai_chatbot_enabled": True,
}


def get(db: Session, key: str) -> Any:
    row = db.get(LibrarySetting, key)
    if row is not None:
        return row.value
    return DEFAULTS.get(key)


def get_all(db: Session) -> dict[str, Any]:
    stored = {r.key: r.value for r in db.query(LibrarySetting).all()}
    return {**DEFAULTS, **stored}


def set_value(db: Session, key: str, value: Any, description: str | None = None) -> None:
    row = db.get(LibrarySetting, key)
    if row is None:
        row = LibrarySetting(key=key, value=value, description=description)
        db.add(row)
    else:
        row.value = value
        if description:
            row.description = description
    db.flush()


def loan_period_days(db: Session, role: str) -> int:
    return int(get(db, "loan_period_days").get(role, 14))


def borrow_limit(db: Session, role: str) -> int:
    return int(get(db, "borrow_limit").get(role, 4))
