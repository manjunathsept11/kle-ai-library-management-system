"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.core.config import settings
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness probe - does not touch the database."""
    return {"status": "ok", "version": __version__, "environment": settings.ENVIRONMENT}


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> dict[str, object]:
    """Readiness probe - verifies the database connection."""
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "ok",
        "database_engine": db.bind.dialect.name if db.bind else "unknown",
        "ai_enabled": settings.AI_ENABLED,
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
    }
