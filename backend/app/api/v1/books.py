"""Book catalogue and copy endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.db.session import get_db
from app.models.user import User
from app.schemas.catalog import (
    BookCreate,
    BookDetail,
    BookSummary,
    BookUpdate,
    CopyCreate,
    CopyOut,
    CopyUpdate,
)
from app.schemas.common import Message, Page
from app.services import catalog_service, search_service

router = APIRouter(tags=["catalogue"])


def _index_book(db: Session, book_id: uuid.UUID) -> None:
    """Best-effort embedding refresh. Never blocks the catalogue write."""
    try:
        book = catalog_service.get_book(db, book_id)
        if search_service.reindex_book(db, book):
            db.commit()
    except Exception:  # indexing must never fail the catalogue write
        db.rollback()


@router.get("/books", response_model=Page[BookSummary])
def list_books(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    q: str | None = Query(default=None, max_length=200),
    category: str | None = None,
    author: str | None = None,
    year: int | None = Query(default=None, ge=1400, le=2100),
    available_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[BookSummary]:
    books, total = catalog_service.list_books(
        db,
        q=q,
        category=category,
        author=author,
        year=year,
        available_only=available_only,
        page=page,
        page_size=page_size,
    )
    return Page[BookSummary](
        items=[BookSummary.model_validate(b) for b in books],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/books/{book_id}", response_model=BookDetail)
def get_book(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> BookDetail:
    return BookDetail.model_validate(catalog_service.get_book(db, book_id))


@router.post("/books", response_model=BookDetail, status_code=201)
def create_book(
    data: BookCreate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> BookDetail:
    book = catalog_service.create_book(db, data, actor_id=staff.id)
    db.commit()
    _index_book(db, book.id)
    return BookDetail.model_validate(catalog_service.get_book(db, book.id))


@router.put("/books/{book_id}", response_model=BookDetail)
def update_book(
    book_id: uuid.UUID,
    data: BookUpdate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> BookDetail:
    book = catalog_service.update_book(db, book_id, data, actor_id=staff.id)
    db.commit()
    _index_book(db, book.id)
    return BookDetail.model_validate(catalog_service.get_book(db, book.id))


@router.delete("/books/{book_id}", response_model=Message)
def archive_book(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> Message:
    catalog_service.archive_book(db, book_id, actor_id=staff.id)
    db.commit()
    return Message(message="Book archived")


@router.post("/books/{book_id}/copies", response_model=list[CopyOut], status_code=201)
def add_copies(
    book_id: uuid.UUID,
    data: CopyCreate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> list[CopyOut]:
    copies = catalog_service.add_copies(db, book_id, data, actor_id=staff.id)
    db.commit()
    return [CopyOut.model_validate(c) for c in copies]


@router.patch("/copies/{copy_id}", response_model=CopyOut)
def update_copy(
    copy_id: uuid.UUID,
    data: CopyUpdate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> CopyOut:
    copy = catalog_service.update_copy(db, copy_id, data, actor_id=staff.id)
    db.commit()
    return CopyOut.model_validate(copy)
