"""Knowledge base: chunk, embed, and retrieve policy/FAQ documents for RAG."""

from __future__ import annotations

import re
import uuid

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import NotFoundError
from app.models.ai import KnowledgeChunk, KnowledgeDocument
from app.models.enums import AccessLevel, Role
from app.services.ai.embeddings import get_embedding_provider

_CHUNK_CHARS = 900
_CHUNK_OVERLAP = 150

_ACCESS_FOR_ROLE = {
    Role.STUDENT: {AccessLevel.PUBLIC},
    Role.FACULTY: {AccessLevel.PUBLIC},
    Role.LIBRARIAN: {AccessLevel.PUBLIC, AccessLevel.STAFF},
    Role.ADMIN: {AccessLevel.PUBLIC, AccessLevel.STAFF, AccessLevel.ADMIN},
}


def _split(text: str) -> list[str]:
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    if len(text) <= _CHUNK_CHARS:
        return [text] if text else []
    chunks, start = [], 0
    while start < len(text):
        end = start + _CHUNK_CHARS
        slice_ = text[start:end]
        if end < len(text):
            cut = slice_.rfind("\n\n")
            if cut == -1:
                cut = slice_.rfind(". ")
            if cut > _CHUNK_CHARS // 2:
                slice_ = slice_[: cut + 1]
                end = start + cut + 1
        chunks.append(slice_.strip())
        start = max(end - _CHUNK_OVERLAP, end)
    return [c for c in chunks if c]


def reindex_document(db: Session, doc: KnowledgeDocument) -> int:
    provider = get_embedding_provider()
    for chunk in list(doc.chunks):
        db.delete(chunk)
    db.flush()

    pieces = _split(doc.body)
    if not pieces:
        return 0
    vectors = provider.embed([f"{doc.title}\n\n{p}" for p in pieces])
    for ordinal, (piece, vector) in enumerate(zip(pieces, vectors, strict=True)):
        db.add(
            KnowledgeChunk(
                document_id=doc.id,
                ordinal=ordinal,
                content=piece,
                token_estimate=len(piece) // 4,
                vector=vector,
                embedding_model=provider.name,
            )
        )
    db.flush()
    return len(pieces)


def reindex_all(db: Session) -> int:
    total = 0
    for doc in db.scalars(
        select(KnowledgeDocument).options(selectinload(KnowledgeDocument.chunks))
    ):
        total += reindex_document(db, doc)
    return total


def get_document(db: Session, doc_id: uuid.UUID) -> KnowledgeDocument:
    doc = db.get(KnowledgeDocument, doc_id)
    if doc is None:
        raise NotFoundError("Knowledge document not found")
    return doc


def retrieve(
    db: Session, query: str, *, role: Role, k: int = 4
) -> list[tuple[KnowledgeChunk, float]]:
    """Return the top-k access-permitted chunks for the query."""
    allowed = _ACCESS_FOR_ROLE.get(role, {AccessLevel.PUBLIC})
    rows = db.execute(
        select(KnowledgeChunk, KnowledgeDocument.access_level, KnowledgeDocument.title)
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .where(KnowledgeDocument.access_level.in_(allowed))
    ).all()
    if not rows:
        return []

    provider = get_embedding_provider()
    q_vec = np.array(provider.embed([query])[0], dtype=np.float32)

    scored: list[tuple[KnowledgeChunk, float]] = []
    for chunk, _access, _title in rows:
        if not chunk.vector:
            continue
        vec = np.array(chunk.vector, dtype=np.float32)
        if vec.shape != q_vec.shape:
            continue
        scored.append((chunk, float(vec @ q_vec)))
    scored.sort(key=lambda s: s[1], reverse=True)
    return scored[:k]
