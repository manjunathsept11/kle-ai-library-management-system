"""Enumerations shared across models. Stored as strings for readability."""

from __future__ import annotations

import enum

from sqlalchemy import Enum as SAEnum


def str_enum(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """A portable string-backed column type for a str Enum.

    Stores the enum *value* (e.g. "student"), works on SQLite and PostgreSQL,
    and hydrates back into the Python enum on load.
    """
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        length=30,
        values_callable=lambda e: [member.value for member in e],
        validate_strings=True,
    )


class Role(str, enum.Enum):
    STUDENT = "student"
    FACULTY = "faculty"
    LIBRARIAN = "librarian"
    ADMIN = "admin"


class UserStatus(str, enum.Enum):
    PENDING = "pending"      # registered, not yet approved / verified
    ACTIVE = "active"
    SUSPENDED = "suspended"


class BookStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class CopyStatus(str, enum.Enum):
    AVAILABLE = "available"
    ISSUED = "issued"
    RESERVED = "reserved"
    LOST = "lost"
    DAMAGED = "damaged"
    MAINTENANCE = "maintenance"
    ARCHIVED = "archived"


class CopyCondition(str, enum.Enum):
    NEW = "new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class LoanStatus(str, enum.Enum):
    ACTIVE = "active"
    RETURNED = "returned"
    OVERDUE = "overdue"
    LOST = "lost"


class ReservationStatus(str, enum.Enum):
    PENDING = "pending"      # waiting in queue
    READY = "ready"          # a copy is held for pickup
    FULFILLED = "fulfilled"  # converted to a loan
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class FineType(str, enum.Enum):
    OVERDUE = "overdue"
    LOST = "lost"
    DAMAGE = "damage"
    REPLACEMENT = "replacement"


class FineStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"
    WAIVED = "waived"


class SearchMode(str, enum.Enum):
    KEYWORD = "keyword"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"


class NotificationType(str, enum.Enum):
    DUE_REMINDER = "due_reminder"
    OVERDUE = "overdue"
    RESERVATION_READY = "reservation_ready"
    RESERVATION_EXPIRED = "reservation_expired"
    FINE_ISSUED = "fine_issued"
    NEW_BOOK = "new_book"
    RECOMMENDATION = "recommendation"
    ANNOUNCEMENT = "announcement"


class ChatRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class AccessLevel(str, enum.Enum):
    PUBLIC = "public"       # any authenticated user
    STAFF = "staff"         # librarian + admin
    ADMIN = "admin"
