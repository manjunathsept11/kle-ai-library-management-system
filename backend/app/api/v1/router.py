"""Aggregate router for API v1."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    books,
    borrow_requests,
    chat,
    circulation,
    favorites,
    fines,
    health,
    notifications,
    reports,
    reservations,
    search,
    taxonomy,
    users,
)

api_router = APIRouter()
for module in (
    health,
    auth,
    users,
    books,
    taxonomy,
    search,
    circulation,
    fines,
    reservations,
    borrow_requests,
    notifications,
    favorites,
    reports,
    chat,
    admin,
):
    api_router.include_router(module.router)
