"""Search endpoints: keyword, AI semantic, hybrid."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.core.config import settings
from app.db.session import get_db
from app.models.enums import SearchMode
from app.models.user import User
from app.schemas.catalog import BookSummary
from app.schemas.search import (
    ReindexResponse,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
)
from app.services import search_service

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
def search_books(
    data: SearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchResponse:
    mode = data.mode
    ai_requested = mode in (SearchMode.SEMANTIC, SearchMode.HYBRID)
    if ai_requested and not settings.AI_ENABLED and mode == SearchMode.SEMANTIC:
        mode = SearchMode.KEYWORD

    hits = search_service.search(
        db,
        data.query,
        mode=mode,
        limit=data.limit,
        available_only=data.available_only,
        year=data.year,
        category=data.category,
        user_id=user.id,
    )
    db.commit()

    note = None
    ai_used = mode in (SearchMode.SEMANTIC, SearchMode.HYBRID) and settings.AI_ENABLED
    if hits and "unavailable" in hits[0].reason:
        ai_used = False
        note = "AI semantic search was unavailable; results are keyword-based."

    return SearchResponse(
        query=data.query,
        mode=mode,
        ai_used=ai_used,
        count=len(hits),
        results=[
            SearchResultItem(
                book=BookSummary.model_validate(h.book),
                score=h.score,
                reason=h.reason,
            )
            for h in hits
        ],
        note=note,
    )


@router.get("/search", response_model=SearchResponse)
def search_books_get(
    q: str,
    mode: SearchMode = SearchMode.HYBRID,
    limit: int = 20,
    available_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchResponse:
    return search_books(
        SearchRequest(
            query=q, mode=mode, limit=limit, available_only=available_only
        ),
        db,
        user,
    )


@router.post("/search/reindex", response_model=ReindexResponse)
def reindex(
    only_missing: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> ReindexResponse:
    count = search_service.reindex_all(db, only_missing=only_missing)
    db.commit()
    return ReindexResponse(
        reindexed=count,
        message=f"Rebuilt embeddings for {count} book(s).",
    )
