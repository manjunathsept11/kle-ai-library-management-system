"""Chatbot schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ChatRole
from app.schemas.common import ORMModel


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    session_id: uuid.UUID | None = None


class GroundedSourceOut(BaseModel):
    kind: str
    label: str
    ref: str | None = None


class ChatResponse(BaseModel):
    session_id: uuid.UUID
    answer: str
    ai_used: bool
    sources: list[GroundedSourceOut]
    disclaimer: str = (
        "AI-generated. Availability, due dates and fines are confirmed against "
        "the library database."
    )


class ChatMessageOut(ORMModel):
    id: uuid.UUID
    role: ChatRole
    content: str
    grounded_sources: list[dict] | None
    created_at: datetime


class ChatSessionOut(ORMModel):
    id: uuid.UUID
    title: str | None
    created_at: datetime


class ChatSessionDetail(ChatSessionOut):
    messages: list[ChatMessageOut]


class SuggestedPrompts(BaseModel):
    prompts: list[str]
