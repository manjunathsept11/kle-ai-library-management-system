"""CRUD for catalogue taxonomy: categories, publishers, authors, shelves."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

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
from app.services import audit_service

# --- categories ------------------------------------------------------

def list_categories(db: Session) -> list[tuple[Category, int]]:
    rows = db.execute(
        select(Category, func.count(Book.id))
        .join(Book, Book.category_id == Category.id, isouter=True)
        .group_by(Category.id)
        .order_by(Category.name)
    ).all()
    return list(rows)


def create_category(
    db: Session, *, name: str, code: str | None, parent_id: uuid.UUID | None,
    actor_id: uuid.UUID,
) -> Category:
    if db.scalar(select(Category).where(func.lower(Category.name) == name.lower())):
        raise ConflictError("A category with this name already exists")
    cat = Category(name=name.strip(), code=(code or None), parent_id=parent_id)
    db.add(cat)
    db.flush()
    audit_service.record(
        db, action="category.create", actor_user_id=actor_id,
        entity_type="category", entity_id=cat.id, summary=cat.name,
    )
    return cat


def update_category(
    db: Session, cat_id: uuid.UUID, *, name: str | None, code: str | None,
    parent_id: uuid.UUID | None, actor_id: uuid.UUID,
) -> Category:
    cat = db.get(Category, cat_id)
    if cat is None:
        raise NotFoundError("Category not found")
    if name:
        cat.name = name.strip()
    if code is not None:
        cat.code = code or None
    if parent_id != cat.id:
        cat.parent_id = parent_id
    db.flush()
    audit_service.record(
        db, action="category.update", actor_user_id=actor_id,
        entity_type="category", entity_id=cat.id,
    )
    return cat


def delete_category(db: Session, cat_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    cat = db.get(Category, cat_id)
    if cat is None:
        raise NotFoundError("Category not found")
    n = db.scalar(select(func.count(Book.id)).where(Book.category_id == cat_id))
    if n:
        raise BusinessRuleError(f"{n} book(s) use this category; reassign them first")
    db.delete(cat)
    db.flush()
    audit_service.record(
        db, action="category.delete", actor_user_id=actor_id,
        entity_type="category", entity_id=cat_id,
    )


# --- publishers -----------------------------------------------------

def list_publishers(db: Session) -> list[tuple[Publisher, int]]:
    rows = db.execute(
        select(Publisher, func.count(Book.id))
        .join(Book, Book.publisher_id == Publisher.id, isouter=True)
        .group_by(Publisher.id)
        .order_by(Publisher.name)
    ).all()
    return list(rows)


def create_publisher(db: Session, *, name: str, actor_id: uuid.UUID) -> Publisher:
    if db.scalar(select(Publisher).where(func.lower(Publisher.name) == name.lower())):
        raise ConflictError("Publisher already exists")
    pub = Publisher(name=name.strip())
    db.add(pub)
    db.flush()
    audit_service.record(
        db, action="publisher.create", actor_user_id=actor_id,
        entity_type="publisher", entity_id=pub.id, summary=pub.name,
    )
    return pub


def update_publisher(
    db: Session, pub_id: uuid.UUID, *, name: str, actor_id: uuid.UUID
) -> Publisher:
    pub = db.get(Publisher, pub_id)
    if pub is None:
        raise NotFoundError("Publisher not found")
    pub.name = name.strip()
    db.flush()
    audit_service.record(
        db, action="publisher.update", actor_user_id=actor_id,
        entity_type="publisher", entity_id=pub.id,
    )
    return pub


def delete_publisher(db: Session, pub_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    pub = db.get(Publisher, pub_id)
    if pub is None:
        raise NotFoundError("Publisher not found")
    n = db.scalar(select(func.count(Book.id)).where(Book.publisher_id == pub_id))
    if n:
        raise BusinessRuleError(f"{n} book(s) use this publisher")
    db.delete(pub)
    db.flush()


# --- authors ------------------------------------------------------

def list_authors(db: Session, q: str | None = None) -> list[tuple[Author, int]]:
    stmt = (
        select(Author, func.count(BookAuthor.book_id))
        .join(BookAuthor, BookAuthor.author_id == Author.id, isouter=True)
        .group_by(Author.id)
        .order_by(Author.name)
    )
    if q:
        stmt = stmt.where(func.lower(Author.name).like(f"%{q.lower()}%"))
    return list(db.execute(stmt.limit(200)).all())


def update_author(
    db: Session, author_id: uuid.UUID, *, name: str | None, bio: str | None,
    actor_id: uuid.UUID,
) -> Author:
    author = db.get(Author, author_id)
    if author is None:
        raise NotFoundError("Author not found")
    if name:
        author.name = name.strip()
    if bio is not None:
        author.bio = bio
    db.flush()
    audit_service.record(
        db, action="author.update", actor_user_id=actor_id,
        entity_type="author", entity_id=author.id,
    )
    return author


# --- shelves -----------------------------------------------------

def list_shelves(db: Session) -> list[tuple[Shelf, int]]:
    rows = db.execute(
        select(Shelf, func.count(BookCopy.id))
        .join(BookCopy, BookCopy.shelf_id == Shelf.id, isouter=True)
        .group_by(Shelf.id)
        .order_by(Shelf.code)
    ).all()
    return list(rows)


def get_shelf(db: Session, shelf_id: uuid.UUID) -> Shelf:
    shelf = db.get(Shelf, shelf_id)
    if shelf is None:
        raise NotFoundError("Shelf not found")
    return shelf


def create_shelf(
    db: Session, *, code: str, name: str, location: str | None,
    capacity: int | None, description: str | None, actor_id: uuid.UUID,
) -> Shelf:
    if db.scalar(select(Shelf).where(func.lower(Shelf.code) == code.lower())):
        raise ConflictError("A shelf with this code already exists")
    shelf = Shelf(
        code=code.strip().upper(), name=name.strip(), location=location,
        capacity=capacity, description=description,
    )
    db.add(shelf)
    db.flush()
    audit_service.record(
        db, action="shelf.create", actor_user_id=actor_id,
        entity_type="shelf", entity_id=shelf.id, summary=shelf.code,
    )
    return shelf


def update_shelf(
    db: Session, shelf_id: uuid.UUID, *, name: str | None, location: str | None,
    capacity: int | None, description: str | None, actor_id: uuid.UUID,
) -> Shelf:
    shelf = get_shelf(db, shelf_id)
    if name:
        shelf.name = name.strip()
    if location is not None:
        shelf.location = location
    if capacity is not None:
        shelf.capacity = capacity
    if description is not None:
        shelf.description = description
    db.flush()
    audit_service.record(
        db, action="shelf.update", actor_user_id=actor_id,
        entity_type="shelf", entity_id=shelf.id,
    )
    return shelf


def delete_shelf(db: Session, shelf_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    shelf = get_shelf(db, shelf_id)
    n = db.scalar(select(func.count(BookCopy.id)).where(BookCopy.shelf_id == shelf_id))
    if n:
        raise BusinessRuleError(
            f"{n} copies are assigned to this shelf; move them first"
        )
    db.delete(shelf)
    db.flush()
    audit_service.record(
        db, action="shelf.delete", actor_user_id=actor_id,
        entity_type="shelf", entity_id=shelf_id,
    )


def shelf_copies(db: Session, shelf_id: uuid.UUID) -> list[BookCopy]:
    return list(
        db.scalars(
            select(BookCopy)
            .where(BookCopy.shelf_id == shelf_id)
            .order_by(BookCopy.barcode)
        )
    )
