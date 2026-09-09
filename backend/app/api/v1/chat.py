"""AI library assistant endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSessionDetail,
    ChatSessionOut,
    GroundedSourceOut,
    SuggestedPrompts,
)
from app.services import chat_service

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    data: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatResponse:
    result = chat_service.ask(
        db, user, data.question, session_id=data.session_id
    )
    db.commit()
    return ChatResponse(
        session_id=result.session_id,
        answer=result.answer,
        ai_used=result.ai_used,
        sources=[GroundedSourceOut(**s.__dict__) for s in result.sources],
    )


@router.get("/chat/prompts", response_model=SuggestedPrompts)
def suggested_prompts(_: User = Depends(get_current_user)) -> SuggestedPrompts:
    return SuggestedPrompts(
        prompts=[
            "Find beginner-friendly books on machine learning",
            "What books do I currently have on loan?",
            "Do I have any outstanding fines?",
            "Explain the library borrowing and renewal policy",
            "What are the library opening hours?",
        ]
    )


@router.get("/chat/sessions", response_model=list[ChatSessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ChatSessionOut]:
    return [
        ChatSessionOut.model_validate(s)
        for s in chat_service.list_sessions(db, user)
    ]


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetail)
def session_detail(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatSessionDetail:
    return ChatSessionDetail.model_validate(
        chat_service.history(db, user, session_id)
    )
