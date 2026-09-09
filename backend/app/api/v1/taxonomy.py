"""Catalogue taxonomy: categories, publishers, authors, shelves (staff)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.db.session import get_db
from app.models.user import User
from app.schemas.catalog import CopyOut
from app.schemas.common import Message
from app.schemas.taxonomy import (
    AuthorIn,
    AuthorOut,
    CategoryIn,
    CategoryOut,
    PublisherIn,
    PublisherOut,
    ShelfIn,
    ShelfOut,
    ShelfUpdate,
)
from app.services import taxonomy_service

router = APIRouter(tags=["taxonomy"])


def _cat(c, n) -> CategoryOut:
    return CategoryOut(
        id=c.id, name=c.name, code=c.code, parent_id=c.parent_id, book_count=n
    )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[CategoryOut]:
    return [_cat(c, n) for c, n in taxonomy_service.list_categories(db)]


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(
    data: CategoryIn, db: Session = Depends(get_db), staff: User = Depends(require_staff)
) -> CategoryOut:
    cat = taxonomy_service.create_category(
        db, name=data.name, code=data.code, parent_id=data.parent_id,
        actor_id=staff.id,
    )
    db.commit()
    return _cat(cat, 0)


@router.patch("/categories/{cat_id}", response_model=CategoryOut)
def update_category(
    cat_id: uuid.UUID,
    data: CategoryIn,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> CategoryOut:
    cat = taxonomy_service.update_category(
        db, cat_id, name=data.name, code=data.code, parent_id=data.parent_id,
        actor_id=staff.id,
    )
    db.commit()
    return _cat(cat, 0)


@router.delete("/categories/{cat_id}", response_model=Message)
def delete_category(
    cat_id: uuid.UUID, db: Session = Depends(get_db), staff: User = Depends(require_staff)
) -> Message:
    taxonomy_service.delete_category(db, cat_id, staff.id)
    db.commit()
    return Message(message="Category deleted")


@router.get("/publishers", response_model=list[PublisherOut])
def list_publishers(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[PublisherOut]:
    return [
        PublisherOut(id=p.id, name=p.name, book_count=n)
        for p, n in taxonomy_service.list_publishers(db)
    ]


@router.post("/publishers", response_model=PublisherOut, status_code=201)
def create_publisher(
    data: PublisherIn, db: Session = Depends(get_db), staff: User = Depends(require_staff)
) -> PublisherOut:
    p = taxonomy_service.create_publisher(db, name=data.name, actor_id=staff.id)
    db.commit()
    return PublisherOut(id=p.id, name=p.name, book_count=0)


@router.patch("/publishers/{pub_id}", response_model=PublisherOut)
def update_publisher(
    pub_id: uuid.UUID,
    data: PublisherIn,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> PublisherOut:
    p = taxonomy_service.update_publisher(db, pub_id, name=data.name, actor_id=staff.id)
    db.commit()
    return PublisherOut(id=p.id, name=p.name, book_count=0)


@router.delete("/publishers/{pub_id}", response_model=Message)
def delete_publisher(
    pub_id: uuid.UUID, db: Session = Depends(get_db), staff: User = Depends(require_staff)
) -> Message:
    taxonomy_service.delete_publisher(db, pub_id, staff.id)
    db.commit()
    return Message(message="Publisher deleted")


@router.get("/authors", response_model=list[AuthorOut])
def list_authors(
    q: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AuthorOut]:
    return [
        AuthorOut(id=a.id, name=a.name, bio=a.bio, book_count=n)
        for a, n in taxonomy_service.list_authors(db, q)
    ]


@router.patch("/authors/{author_id}", response_model=AuthorOut)
def update_author(
    author_id: uuid.UUID,
    data: AuthorIn,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> AuthorOut:
    a = taxonomy_service.update_author(
        db, author_id, name=data.name, bio=data.bio, actor_id=staff.id
    )
    db.commit()
    return AuthorOut(id=a.id, name=a.name, bio=a.bio, book_count=0)


# --- shelves ---------------------------------------------------

def _shelf(s, n) -> ShelfOut:
    return ShelfOut(
        id=s.id, code=s.code, name=s.name, location=s.location,
        capacity=s.capacity, description=s.description, copy_count=n,
    )


@router.get("/shelves", response_model=list[ShelfOut])
def list_shelves(
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[ShelfOut]:
    return [_shelf(s, n) for s, n in taxonomy_service.list_shelves(db)]


@router.get("/shelves/{shelf_id}/copies", response_model=list[CopyOut])
def shelf_copies(
    shelf_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> list[CopyOut]:
    return [
        CopyOut.model_validate(c) for c in taxonomy_service.shelf_copies(db, shelf_id)
    ]


@router.post("/shelves", response_model=ShelfOut, status_code=201)
def create_shelf(
    data: ShelfIn, db: Session = Depends(get_db), staff: User = Depends(require_staff)
) -> ShelfOut:
    s = taxonomy_service.create_shelf(
        db, code=data.code, name=data.name, location=data.location,
        capacity=data.capacity, description=data.description, actor_id=staff.id,
    )
    db.commit()
    return _shelf(s, 0)


@router.patch("/shelves/{shelf_id}", response_model=ShelfOut)
def update_shelf(
    shelf_id: uuid.UUID,
    data: ShelfUpdate,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> ShelfOut:
    s = taxonomy_service.update_shelf(
        db, shelf_id, name=data.name, location=data.location,
        capacity=data.capacity, description=data.description, actor_id=staff.id,
    )
    db.commit()
    return _shelf(s, 0)


@router.delete("/shelves/{shelf_id}", response_model=Message)
def delete_shelf(
    shelf_id: uuid.UUID,
    db: Session = Depends(get_db),
    staff: User = Depends(require_staff),
) -> Message:
    taxonomy_service.delete_shelf(db, shelf_id, staff.id)
    db.commit()
    return Message(message="Shelf deleted")
