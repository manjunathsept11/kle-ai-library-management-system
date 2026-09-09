"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChange,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserOut,
    UserUpdate,
)
from app.schemas.common import Message
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> User:
    user = auth_service.register(db, data)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenPair:
    _, access, refresh_token, expires_in = auth_service.login(
        db, data.email, data.password, user_agent=request.headers.get("user-agent")
    )
    db.commit()
    return TokenPair(
        access_token=access, refresh_token=refresh_token, expires_in=expires_in
    )


@router.post("/refresh", response_model=TokenPair)
def refresh(
    data: RefreshRequest, request: Request, db: Session = Depends(get_db)
) -> TokenPair:
    _, access, refresh_token, expires_in = auth_service.refresh(
        db, data.refresh_token, user_agent=request.headers.get("user-agent")
    )
    db.commit()
    return TokenPair(
        access_token=access, refresh_token=refresh_token, expires_in=expires_in
    )


@router.post("/logout", response_model=Message)
def logout(data: RefreshRequest, db: Session = Depends(get_db)) -> Message:
    auth_service.logout(db, data.refresh_token)
    db.commit()
    return Message(message="Logged out")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.phone is not None:
        user.phone = data.phone
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/password", response_model=Message)
def change_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Message:
    auth_service.change_password(db, user, data.current_password, data.new_password)
    db.commit()
    return Message(message="Password updated. Please log in again.")
