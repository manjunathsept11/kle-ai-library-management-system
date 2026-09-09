"""Bibliographic catalogue: books, contributors, and physical copies.

A ``Book`` is the bibliographic record; a ``BookCopy`` is a single physical
item on a shelf. Circulation always acts on a copy, never on a book.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey
from app.models.enums import BookStatus, CopyCondition, CopyStatus, str_enum


class Publisher(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "publishers"

    name: Mapped[str] = mapped_column(String(200), unique=True)


class Author(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "authors"

    name: Mapped[str] = mapped_column(String(200), index=True)
    bio: Mapped[str | None] = mapped_column(Text)


class Category(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(120), index=True)
    code: Mapped[str | None] = mapped_column(String(30), unique=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )

    parent: Mapped[Category | None] = relationship(remote_side="Category.id")


class BookAuthor(Base):
    __tablename__ = "book_authors"

    book_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("authors.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, default=1)

    author: Mapped[Author] = relationship()


class Book(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "books"
    __table_args__ = (
        Index("ix_books_title", "title"),
        Index("ix_books_year", "publication_year"),
    )

    isbn: Mapped[str | None] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(500))
    subtitle: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[str | None] = mapped_column(Text)

    publisher_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("publishers.id", ondelete="SET NULL")
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL")
    )
    edition: Mapped[str | None] = mapped_column(String(60))
    publication_year: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str] = mapped_column(String(40), default="English")
    subject: Mapped[str | None] = mapped_column(String(200))

    cover_image_url: Mapped[str | None] = mapped_column(String(500))
    digital_resource_url: Mapped[str | None] = mapped_column(String(500))

    # AI-generated tags; clearly marked as AI-derived in the UI.
    ai_tags: Mapped[list[str] | None] = mapped_column(JSON)

    status: Mapped[BookStatus] = mapped_column(
        str_enum(BookStatus, "book_status"), default=BookStatus.ACTIVE
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    publisher: Mapped[Publisher | None] = relationship()
    category: Mapped[Category | None] = relationship()
    authors: Mapped[list[BookAuthor]] = relationship(
        order_by="BookAuthor.position", cascade="all, delete-orphan"
    )
    copies: Mapped[list[BookCopy]] = relationship(
        back_populates="book", cascade="all, delete-orphan"
    )
    embedding: Mapped[BookEmbedding | None] = relationship(
        back_populates="book", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def author_names(self) -> list[str]:
        return [ba.author.name for ba in self.authors]

    @property
    def total_copies(self) -> int:
        return sum(1 for c in self.copies if c.status != CopyStatus.ARCHIVED)

    @property
    def available_copies(self) -> int:
        return sum(1 for c in self.copies if c.status == CopyStatus.AVAILABLE)


class BookCopy(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "book_copies"
    __table_args__ = (UniqueConstraint("barcode", name="uq_copy_barcode"),)

    book_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), index=True
    )
    barcode: Mapped[str] = mapped_column(String(60))
    acquisition_date: Mapped[date | None] = mapped_column(Date)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    shelf_location: Mapped[str | None] = mapped_column(String(80))
    condition: Mapped[CopyCondition] = mapped_column(
        str_enum(CopyCondition, "copy_condition"), default=CopyCondition.GOOD
    )
    status: Mapped[CopyStatus] = mapped_column(
        str_enum(CopyStatus, "copy_status"), default=CopyStatus.AVAILABLE
    )
    notes: Mapped[str | None] = mapped_column(String(300))
    last_inventory_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    book: Mapped[Book] = relationship(back_populates="copies")


class BookEmbedding(Base):
    """One embedding vector per book, stored as JSON for the SQLite dev setup.

    Production (pgvector) replaces the JSON column with a native ``vector`` type;
    the service layer is the only place that needs to change.
    """

    __tablename__ = "book_embeddings"

    book_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    model: Mapped[str] = mapped_column(String(120))
    dim: Mapped[int] = mapped_column(Integer)
    vector: Mapped[list[float]] = mapped_column(JSON)
    # Hash of the text that was embedded, to skip re-embedding unchanged books.
    source_hash: Mapped[str] = mapped_column(String(64))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now()
    )

    book: Mapped[Book] = relationship(back_populates="embedding")

    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON)
