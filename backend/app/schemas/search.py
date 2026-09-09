"""Search request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import SearchMode
from app.schemas.catalog import BookSummary


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=400)
    mode: SearchMode = SearchMode.HYBRID
    limit: int = Field(default=20, ge=1, le=50)
    available_only: bool = False
    year: int | None = Field(default=None, ge=1400, le=2100)
    category: str | None = None


class SearchResultItem(BaseModel):
    book: BookSummary
    score: float
    reason: str  # human-readable "why this result" explanation


class SearchResponse(BaseModel):
    query: str
    mode: SearchMode
    ai_used: bool
    count: int
    results: list[SearchResultItem]
    note: str | None = None


class ReindexResponse(BaseModel):
    reindexed: int
    message: str
