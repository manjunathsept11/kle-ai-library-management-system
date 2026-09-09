"""Taxonomy schemas: categories, publishers, authors, shelves."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CategoryOut(ORMModel):
    id: uuid.UUID
    name: str
    code: str | None
    parent_id: uuid.UUID | None
    book_count: int = 0


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=30)
    parent_id: uuid.UUID | None = None


class PublisherOut(ORMModel):
    id: uuid.UUID
    name: str
    book_count: int = 0


class PublisherIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class AuthorOut(ORMModel):
    id: uuid.UUID
    name: str
    bio: str | None = None
    book_count: int = 0


class AuthorIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    bio: str | None = None


class ShelfOut(ORMModel):
    id: uuid.UUID
    code: str
    name: str
    location: str | None
    capacity: int | None
    description: str | None
    copy_count: int = 0


class ShelfIn(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=120)
    location: str | None = Field(default=None, max_length=160)
    capacity: int | None = Field(default=None, ge=0, le=100000)
    description: str | None = None


class ShelfUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    location: str | None = None
    capacity: int | None = Field(default=None, ge=0, le=100000)
    description: str | None = None
