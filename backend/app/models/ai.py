"""AI-related persistence: knowledge base, chat history, search logs.

None of this is authoritative library data. The relational tables above remain
the source of truth for availability, loans, fines and reservations.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPrimaryKey
from app.models.enums import AccessLevel, ChatRole, SearchMode, str_enum


class KnowledgeDocument(UUIDPrimaryKey, Timestamps, Base):
    """A policy / FAQ / guide document that grounds the chatbot (RAG)."""

    __tablename__ = "knowledge_documents"

    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str | None] = mapped_column(String(80))
    access_level: Mapped[AccessLevel] = mapped_column(
        str_enum(AccessLevel, "access_level"), default=AccessLevel.PUBLIC
    )
    body: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(300))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    chunks: Mapped[list[KnowledgeChunk]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KnowledgeChunk(UUIDPrimaryKey, Base):
    __tablename__ = "knowledge_chunks"
    __table_args__ = (Index("ix_chunk_doc_ordinal", "document_id", "ordinal"),)

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"), index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    token_estimate: Mapped[int] = mapped_column(Integer, default=0)
    vector: Mapped[list[float] | None] = mapped_column(JSON)
    embedding_model: Mapped[str | None] = mapped_column(String(120))

    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")


class ChatSession(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "chat_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str | None] = mapped_column(String(200))

    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(UUIDPrimaryKey, Base):
    __tablename__ = "chat_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[ChatRole] = mapped_column(str_enum(ChatRole, "chat_role"))
    content: Mapped[str] = mapped_column(Text)
    # Sources the answer was grounded in (doc ids, book ids, tool names).
    grounded_sources: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class SearchLog(UUIDPrimaryKey, Base):
    __tablename__ = "search_logs"
    __table_args__ = (Index("ix_search_created", "created_at"),)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    query: Mapped[str] = mapped_column(String(500))
    mode: Mapped[SearchMode] = mapped_column(str_enum(SearchMode, "search_mode"))
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    top_book_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("books.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
