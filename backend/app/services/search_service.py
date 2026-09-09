"""Book search: keyword, AI semantic, and hybrid.

Semantic search embeds the query and ranks books by cosine similarity against
stored book embeddings (loaded into NumPy). At one-institute scale this is
fast and needs no vector database; production swaps this module for pgvector
queries without changing the API layer.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass

import numpy as np
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.errors import AIServiceError
from app.models.ai import SearchLog
from app.models.catalog import Author, Book, BookAuthor, BookEmbedding
from app.models.enums import BookStatus, SearchMode
from app.services.ai.embeddings import get_embedding_provider


@dataclass
class SearchHit:
    book: Book
    score: float
    reason: str


def _book_text(book: Book) -> str:
    parts = [
        book.title,
        book.subtitle or "",
        " ".join(book.author_names),
        book.category.name if book.category else "",
        book.subject or "",
        book.keywords or "",
        (book.description or "")[:1500],
    ]
    return "\n".join(p for p in parts if p).strip()


def _source_hash(text: str, model: str) -> str:
    return hashlib.sha256(f"{model}:{text}".encode()).hexdigest()


# --- indexing -----------------------------------------------------------

def reindex_book(db: Session, book: Book) -> bool:
    """Compute and store the embedding for one book. Returns True if changed."""
    provider = get_embedding_provider()
    text = _book_text(book)
    src_hash = _source_hash(text, provider.name)

    existing = db.get(BookEmbedding, book.id)
    if existing and existing.source_hash == src_hash:
        return False

    vector = provider.embed([text])[0]
    if existing:
        existing.model = provider.name
        existing.dim = len(vector)
        existing.vector = vector
        existing.source_hash = src_hash
    else:
        db.add(
            BookEmbedding(
                book_id=book.id,
                model=provider.name,
                dim=len(vector),
                vector=vector,
                source_hash=src_hash,
            )
        )
    db.flush()
    return True


def reindex_all(db: Session, *, only_missing: bool = False) -> int:
    stmt = select(Book).where(Book.status == BookStatus.ACTIVE).options(
        selectinload(Book.authors).selectinload(BookAuthor.author),
        selectinload(Book.category),
    )
    changed = 0
    for book in db.scalars(stmt).unique():
        if only_missing and db.get(BookEmbedding, book.id) is not None:
            continue
        if reindex_book(db, book):
            changed += 1
    return changed


# --- keyword search ---------------------------------------------------

_KW_LOADERS = (
    selectinload(Book.authors).selectinload(BookAuthor.author),
    selectinload(Book.copies),
    selectinload(Book.category),
    selectinload(Book.publisher),
)


def _keyword_candidates(
    db: Session, query: str, limit: int
) -> list[tuple[Book, float]]:
    like = f"%{query.lower()}%"
    terms = [t for t in query.lower().split() if len(t) > 1]

    stmt = (
        select(Book)
        .options(*_KW_LOADERS)
        .where(Book.status == BookStatus.ACTIVE)
        .where(
            or_(
                func.lower(Book.title).like(like),
                func.lower(func.coalesce(Book.subtitle, "")).like(like),
                func.lower(func.coalesce(Book.keywords, "")).like(like),
                func.lower(func.coalesce(Book.subject, "")).like(like),
                func.lower(func.coalesce(Book.description, "")).like(like),
                func.lower(func.coalesce(Book.isbn, "")).like(like),
                Book.authors.any(
                    BookAuthor.author.has(func.lower(Author.name).like(like))
                ),
            )
        )
        .limit(limit * 3)
    )
    results: list[tuple[Book, float]] = []
    for book in db.scalars(stmt).unique():
        haystack = _book_text(book).lower()
        score = 0.0
        if query.lower() in book.title.lower():
            score += 3.0
        for term in terms:
            if term in book.title.lower():
                score += 1.5
            elif term in haystack:
                score += 0.5
        results.append((book, score or 0.1))
    results.sort(key=lambda r: r[1], reverse=True)
    return results[:limit]


# --- semantic search --------------------------------------------------

def _load_vectors(db: Session) -> tuple[list[uuid.UUID], np.ndarray, str]:
    rows = db.execute(
        select(BookEmbedding.book_id, BookEmbedding.vector, BookEmbedding.model)
    ).all()
    if not rows:
        return [], np.zeros((0, 1)), ""
    ids = [r[0] for r in rows]
    matrix = np.array([r[1] for r in rows], dtype=np.float32)
    model = rows[0][2]
    return ids, matrix, model


def _semantic_candidates(
    db: Session, query: str, limit: int
) -> list[tuple[uuid.UUID, float]]:
    if not settings.AI_ENABLED:
        raise AIServiceError("AI features are disabled")

    ids, matrix, _ = _load_vectors(db)
    if not ids:
        return []

    provider = get_embedding_provider()
    q_vec = np.array(provider.embed([query])[0], dtype=np.float32)

    # Stored vectors and query vector are both L2-normalised, so dot == cosine.
    if matrix.shape[1] != q_vec.shape[0]:
        # Dimension mismatch (provider changed) - semantic index is stale.
        raise AIServiceError(
            "The semantic index is out of date. Ask staff to rebuild it."
        )
    sims = matrix @ q_vec
    order = np.argsort(-sims)[:limit]
    return [(ids[i], float(sims[i])) for i in order]


# --- public API -----------------------------------------------------

def _apply_filters(
    hits: list[SearchHit],
    *,
    available_only: bool,
    year: int | None,
    category: str | None,
) -> list[SearchHit]:
    out = []
    for hit in hits:
        b = hit.book
        if available_only and b.available_copies < 1:
            continue
        if year and b.publication_year != year:
            continue
        if category and (not b.category or b.category.name.lower() != category.lower()):
            continue
        out.append(hit)
    return out


def search(
    db: Session,
    query: str,
    *,
    mode: SearchMode = SearchMode.HYBRID,
    limit: int = 20,
    available_only: bool = False,
    year: int | None = None,
    category: str | None = None,
    user_id: uuid.UUID | None = None,
    log: bool = True,
) -> list[SearchHit]:
    query = query.strip()
    if not query:
        return []

    pool = max(limit * 3, 30)
    kw = dict(_keyword_candidates(db, query, pool)) if mode != SearchMode.SEMANTIC else {}
    sem: dict[uuid.UUID, float] = {}
    semantic_failed = False

    if mode in (SearchMode.SEMANTIC, SearchMode.HYBRID):
        try:
            sem = dict(_semantic_candidates(db, query, pool))
        except AIServiceError:
            if mode == SearchMode.SEMANTIC:
                raise
            semantic_failed = True  # hybrid degrades to keyword

    # Normalise each signal to 0..1.
    def _norm(d: dict) -> dict:
        if not d:
            return {}
        lo, hi = min(d.values()), max(d.values())
        rng = (hi - lo) or 1.0
        return {k: (v - lo) / rng for k, v in d.items()}

    kw_n, sem_n = _norm({k.id: v for k, v in kw.items()}), _norm(sem)
    book_by_id = {b.id: b for b in kw}

    missing_ids = [bid for bid in sem_n if bid not in book_by_id]
    if missing_ids:
        extra = db.scalars(
            select(Book).options(*_KW_LOADERS).where(Book.id.in_(missing_ids))
        ).unique()
        for b in extra:
            book_by_id[b.id] = b

    combined: dict[uuid.UUID, tuple[float, str]] = {}
    for bid in book_by_id:
        ks, ss = kw_n.get(bid, 0.0), sem_n.get(bid, 0.0)
        if mode == SearchMode.KEYWORD:
            score, reason = ks, "Keyword match"
        elif mode == SearchMode.SEMANTIC:
            score, reason = ss, "AI semantic match"
        else:
            score = 0.45 * ks + 0.55 * ss
            if ks > 0 and ss > 0:
                reason = "Keyword + AI semantic match"
            elif ss > 0:
                reason = "AI semantic match"
            else:
                reason = "Keyword match"
        combined[bid] = (score, reason)

    hits = [
        SearchHit(book=book_by_id[bid], score=round(sc, 4), reason=rs)
        for bid, (sc, rs) in combined.items()
    ]
    hits.sort(key=lambda h: h.score, reverse=True)
    hits = _apply_filters(
        hits, available_only=available_only, year=year, category=category
    )[:limit]

    if semantic_failed and hits:
        hits[0].reason += " (AI semantic search unavailable - showing keyword results)"

    if log:
        db.add(
            SearchLog(
                user_id=user_id,
                query=query[:500],
                mode=mode,
                result_count=len(hits),
                top_book_id=hits[0].book.id if hits else None,
            )
        )
        db.flush()

    return hits
