"""Time helpers.

SQLite stores naive datetimes. To keep comparisons correct on both SQLite and
PostgreSQL, treat any naive datetime read back from the database as UTC.
"""

from __future__ import annotations

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt
