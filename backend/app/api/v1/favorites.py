"""Member favorites / saved books."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.errors import ConflictError, NotFoundError
from app.db.session import get_db
from app.models.catalog import Book
from app.models.engagement import Favorite
from app.models.user import User
from app.schemas.catalog import BookSummary
from app.schemas.common import Message
from app.schemas.engagement import FavoriteOut

router = APIRouter(tags=["favorites"])


@router.get("/me/favorites", response_model=list[FavoriteOut])
def list_favorites(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[FavoriteOut]:
    rows = db.scalars(
        select(Favorite)
        .where(Favorite.user_id == user.id)
        .options(selectinload(Favorite.book).selectinload(Book.authors))
        .order_by(Favorite.created_at.desc())
    )
    return [
        FavoriteOut(
            book=BookSummary.model_validate(f.book), created_at=f.created_at
        )
        for f in rows
    ]


@router.put("/me/favorites/{book_id}", response_model=Message, status_code=201)
def add_favorite(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Message:
    if db.get(Book, book_id) is None:
        raise NotFoundError("Book not found")
    if db.get(Favorite, {"user_id": user.id, "book_id": book_id}):
        raise ConflictError("Already in favorites")
    db.add(Favorite(user_id=user.id, book_id=book_id))
    db.commit()
    return Message(message="Added to favorites")


@router.delete("/me/favorites/{book_id}", response_model=Message)
def remove_favorite(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Message:
    fav = db.get(Favorite, {"user_id": user.id, "book_id": book_id})
    if fav:
        db.delete(fav)
        db.commit()
    return Message(message="Removed")
