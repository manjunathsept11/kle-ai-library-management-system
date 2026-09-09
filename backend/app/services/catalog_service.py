"""Catalogue operations: books, authors, categories, copies."""

from __future__ import annotations

import itertools
import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.models.catalog import (
    Author,
    Book,
    BookAuthor,
    BookCopy,
    Category,
    Publisher,
    Shelf,
)
from app.models.enums import BookStatus, CopyStatus
from app.schemas.catalog import BookCreate, BookUpdate, CopyCreate, CopyUpdate
from app.services import audit_service

_BOOK_LOADERS = (
    selectinload(Book.authors).selectinload(BookAuthor.author),
    selectinload(Book.copies),
    selectinload(Book.publisher),
    selectinload(Book.category),
)

_barcode_counter = itertools.count(1)


def _get_or_create_author(db: Session, name: str) -> Author:
    name = name.strip()
    author = db.scalar(select(Author).where(func.lower(Author.name) == name.lower()))
    if author is None:
        author = Author(name=name)
        db.add(author)
        db.flush()
    return author


def _get_or_create_publisher(db: Session, name: str | None) -> Publisher | None:
    if not name:
        return None
    name = name.strip()
    pub = db.scalar(select(Publisher).where(func.lower(Publisher.name) == name.lower()))
    if pub is None:
        pub = Publisher(name=name)
        db.add(pub)
        db.flush()
    return pub


def _get_or_create_category(db: Session, name: str | None) -> Category | None:
    if not name:
        return None
    name = name.strip()
    cat = db.scalar(select(Category).where(func.lower(Category.name) == name.lower()))
    if cat is None:
        cat = Category(name=name)
        db.add(cat)
        db.flush()
    return cat


def _make_barcode(db: Session) -> str:
    for _ in range(10000):
        candidate = f"KLE{next(_barcode_counter):07d}"
        if not db.scalar(select(BookCopy.id).where(BookCopy.barcode == candidate)):
            return candidate
    raise BusinessRuleError("Could not allocate a unique barcode")


def get_book(db: Session, book_id: uuid.UUID) -> Book:
    book = db.scalar(
        select(Book).where(Book.id == book_id).options(*_BOOK_LOADERS)
    )
    if book is None:
        raise NotFoundError("Book not found")
    return book


def list_books(
    db: Session,
    *,
    q: str | None = None,
    category: str | None = None,
    author: str | None = None,
    year: int | None = None,
    available_only: bool = False,
    include_archived: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Book], int]:
    stmt = select(Book).options(*_BOOK_LOADERS)
    count_stmt = select(func.count(Book.id))

    filters = []
    if not include_archived:
        filters.append(Book.status == BookStatus.ACTIVE)
    if q:
        like = f"%{q.lower()}%"
        filters.append(
            or_(
                func.lower(Book.title).like(like),
                func.lower(func.coalesce(Book.subtitle, "")).like(like),
                func.lower(func.coalesce(Book.keywords, "")).like(like),
                func.lower(func.coalesce(Book.description, "")).like(like),
                func.lower(func.coalesce(Book.isbn, "")).like(like),
            )
        )
    if year:
        filters.append(Book.publication_year == year)
    if category:
        stmt = stmt.join(Book.category)
        count_stmt = count_stmt.join(Book.category)
        filters.append(func.lower(Category.name) == category.lower())
    if author:
        stmt = stmt.join(Book.authors).join(BookAuthor.author)
        count_stmt = count_stmt.join(Book.authors).join(BookAuthor.author)
        filters.append(func.lower(Author.name).like(f"%{author.lower()}%"))

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = db.scalar(count_stmt) or 0
    stmt = stmt.order_by(Book.title).offset((page - 1) * page_size).limit(page_size)
    books = list(db.scalars(stmt).unique())

    if available_only:
        books = [b for b in books if b.available_copies > 0]

    return books, total


def create_book(
    db: Session, data: BookCreate, *, actor_id: uuid.UUID
) -> Book:
    if data.isbn:
        dupe = db.scalar(select(Book).where(Book.isbn == data.isbn))
        if dupe:
            raise ConflictError(f"A book with ISBN {data.isbn} already exists")

    book = Book(
        title=data.title.strip(),
        subtitle=data.subtitle,
        isbn=data.isbn,
        description=data.description,
        keywords=data.keywords,
        edition=data.edition,
        publication_year=data.publication_year,
        language=data.language,
        subject=data.subject,
        cover_image_url=data.cover_image_url,
        digital_resource_url=data.digital_resource_url,
        publisher=_get_or_create_publisher(db, data.publisher_name),
        category=_get_or_create_category(db, data.category_name),
        created_by=actor_id,
    )
    for position, name in enumerate(data.authors, start=1):
        if name.strip():
            book.authors.append(
                BookAuthor(author=_get_or_create_author(db, name), position=position)
            )
    db.add(book)
    db.flush()

    for _ in range(data.initial_copies):
        db.add(
            BookCopy(
                book_id=book.id,
                barcode=_make_barcode(db),
                shelf_location=data.shelf_location,
                acquisition_date=date.today(),
                status=CopyStatus.AVAILABLE,
            )
        )
    db.flush()

    audit_service.record(
        db, action="book.create", actor_user_id=actor_id,
        entity_type="book", entity_id=book.id, summary=book.title,
    )
    return get_book(db, book.id)


def update_book(
    db: Session, book_id: uuid.UUID, data: BookUpdate, *, actor_id: uuid.UUID
) -> Book:
    book = get_book(db, book_id)
    payload = data.model_dump(exclude_unset=True)

    if "publisher_name" in payload:
        book.publisher = _get_or_create_publisher(db, payload.pop("publisher_name"))
    if "category_name" in payload:
        book.category = _get_or_create_category(db, payload.pop("category_name"))
    if "authors" in payload:
        names = payload.pop("authors") or []
        book.authors.clear()
        db.flush()
        for position, name in enumerate(names, start=1):
            if name.strip():
                book.authors.append(
                    BookAuthor(
                        author=_get_or_create_author(db, name), position=position
                    )
                )
    for field, value in payload.items():
        setattr(book, field, value)

    db.flush()
    audit_service.record(
        db, action="book.update", actor_user_id=actor_id,
        entity_type="book", entity_id=book.id, summary=book.title,
    )
    return get_book(db, book.id)


def archive_book(db: Session, book_id: uuid.UUID, *, actor_id: uuid.UUID) -> None:
    book = get_book(db, book_id)
    active_loans = any(
        c.status == CopyStatus.ISSUED for c in book.copies
    )
    if active_loans:
        raise BusinessRuleError("Cannot archive a book that has copies on loan")
    book.status = BookStatus.ARCHIVED
    for copy in book.copies:
        if copy.status == CopyStatus.AVAILABLE:
            copy.status = CopyStatus.ARCHIVED
    db.flush()
    audit_service.record(
        db, action="book.archive", actor_user_id=actor_id,
        entity_type="book", entity_id=book.id, summary=book.title,
    )


def add_copies(
    db: Session, book_id: uuid.UUID, data: CopyCreate, *, actor_id: uuid.UUID
) -> list[BookCopy]:
    book = get_book(db, book_id)
    shelf_label = data.shelf_location
    if data.shelf_id is not None:
        shelf = db.get(Shelf, data.shelf_id)
        if shelf is None:
            raise NotFoundError("Shelf not found")
        shelf_label = shelf_label or shelf.code
    created: list[BookCopy] = []
    for _ in range(data.count):
        copy = BookCopy(
            book_id=book.id,
            barcode=_make_barcode(db),
            shelf_location=shelf_label,
            shelf_id=data.shelf_id,
            condition=data.condition,
            price=data.price,
            acquisition_date=data.acquisition_date or date.today(),
            status=CopyStatus.AVAILABLE,
        )
        db.add(copy)
        created.append(copy)
    db.flush()
    audit_service.record(
        db, action="copy.create", actor_user_id=actor_id,
        entity_type="book", entity_id=book.id,
        summary=f"Added {data.count} copies",
    )
    return created


def update_copy(
    db: Session, copy_id: uuid.UUID, data: CopyUpdate, *, actor_id: uuid.UUID
) -> BookCopy:
    copy = db.get(BookCopy, copy_id)
    if copy is None:
        raise NotFoundError("Copy not found")
    if data.status and copy.status == CopyStatus.ISSUED and data.status != (
        CopyStatus.ISSUED
    ):
        raise BusinessRuleError(
            "This copy is on loan; process a return before changing its status"
        )
    payload = data.model_dump(exclude_unset=True)
    if "shelf_id" in payload and payload["shelf_id"] is not None:
        shelf = db.get(Shelf, payload["shelf_id"])
        if shelf is None:
            raise NotFoundError("Shelf not found")
        copy.shelf_location = shelf.code
    for field, value in payload.items():
        setattr(copy, field, value)
    db.flush()
    audit_service.record(
        db, action="copy.update", actor_user_id=actor_id,
        entity_type="copy", entity_id=copy.id,
    )
    return copy


def list_copies(
    db: Session,
    *,
    q: str | None = None,
    status: CopyStatus | None = None,
    book_id: uuid.UUID | None = None,
    shelf_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 30,
) -> tuple[list[tuple[BookCopy, str, str | None]], int]:
    stmt = (
        select(BookCopy, Book.title, Shelf.code)
        .join(Book, Book.id == BookCopy.book_id)
        .join(Shelf, Shelf.id == BookCopy.shelf_id, isouter=True)
    )
    count = select(func.count(BookCopy.id)).join(Book, Book.id == BookCopy.book_id)
    conds = []
    if status:
        conds.append(BookCopy.status == status)
    if book_id:
        conds.append(BookCopy.book_id == book_id)
    if shelf_id:
        conds.append(BookCopy.shelf_id == shelf_id)
    if q:
        like = f"%{q.lower()}%"
        conds.append(
            or_(
                func.lower(Book.title).like(like),
                func.lower(BookCopy.barcode).like(like),
            )
        )
    for c in conds:
        stmt = stmt.where(c)
        count = count.where(c)
    total = db.scalar(count) or 0
    stmt = (
        stmt.order_by(Book.title, BookCopy.barcode)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [(row[0], row[1], row[2]) for row in db.execute(stmt).all()], total
