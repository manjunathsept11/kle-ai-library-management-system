"""Helper to write audit-log entries consistently."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def record(
    db: Session,
    *,
    action: str,
    actor_user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: Any = None,
    summary: str | None = None,
    ip_address: str | None = None,
    request_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        action=action,
        actor_user_id=actor_user_id,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        summary=summary,
        ip_address=ip_address,
        request_id=request_id,
        meta=meta,
    )
    db.add(entry)
    db.flush()
    return entry
