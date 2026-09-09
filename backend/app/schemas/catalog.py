"""Catalogue schemas: books, copies, authors, categories."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import BookStatus, CopyCondition, CopyStatus
from app.schemas.common import ORMModel


class AuthorOut(ORMModel):
    id: uuid.UUID
    name: str


class CategoryOut(ORMModel):
    id: uuid.UUID
    name: str
    code: str | None
    parent_id: uuid.UUID | None


class PublisherOut(ORMModel):
    id: uuid.UUID
    name: str


class CopyOut(ORMModel):
    id: uuid.UUID
    barcode: str
    status: CopyStatus
    condition: CopyCondition
    shelf_location: str | None
    acquisition_date: date | None


class BookSummary(ORMModel):
    id: uuid.UUID
    title: str
    subtitle: str | None
    isbn: str | None
    publication_year: int | None
    language: str
    cover_image_url: str | None
    status: BookStatus
    author_names: list[str]
    total_copies: int
    available_copies: int
    ai_tags: list[str] | None


class BookDetail(BookSummary):
    description: str | None
    keywords: str | None
    edition: str | None
    subject: str | None
    digital_resource_url: str | None
    publisher: PublisherOut | None
    category: CategoryOut | None
    copies: list[CopyOut]
    created_at: datetime


class BookAuthorIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    subtitle: str | None = Field(default=None, max_length=500)
    isbn: str | None = Field(default=None, max_length=20)
    description: str | None = None
    keywords: str | None = None
    edition: str | None = Field(default=None, max_length=60)
    publication_year: int | None = Field(default=None, ge=1400, le=2100)
    language: str = "English"
    subject: str | None = Field(default=None, max_length=200)
    publisher_name: str | None = Field(default=None, max_length=200)
    category_name: str | None = Field(default=None, max_length=120)
    cover_image_url: str | None = Field(default=None, max_length=500)
    digital_resource_url: str | None = Field(default=None, max_length=500)
    authors: list[str] = Field(default_factory=list)
    # Optionally create N copies immediately.
    initial_copies: int = Field(default=0, ge=0, le=100)
    shelf_location: str | None = Field(default=None, max_length=80)


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    subtitle: str | None = None
    isbn: str | None = None
    description: str | None = None
    keywords: str | None = None
    edition: str | None = None
    publication_year: int | None = Field(default=None, ge=1400, le=2100)
    language: str | None = None
    subject: str | None = None
    publisher_name: str | None = None
    category_name: str | None = None
    cover_image_url: str | None = None
    digital_resource_url: str | None = None
    authors: list[str] | None = None
    status: BookStatus | None = None


class CopyCreate(BaseModel):
    count: int = Field(default=1, ge=1, le=100)
    shelf_location: str | None = Field(default=None, max_length=80)
    condition: CopyCondition = CopyCondition.GOOD
    price: float | None = Field(default=None, ge=0)
    acquisition_date: date | None = None


class CopyUpdate(BaseModel):
    status: CopyStatus | None = None
    condition: CopyCondition | None = None
    shelf_location: str | None = None
    notes: str | None = None
