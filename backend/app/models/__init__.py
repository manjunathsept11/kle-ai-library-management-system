"""ORM models.

``load_all()`` imports every model module so that ``Base.metadata`` is complete
for Alembic autogenerate and test setup. Import order matters only for
relationship string resolution, which SQLAlchemy defers, so a flat list is fine.
"""

from __future__ import annotations


def load_all() -> None:
    from app.models import (  # noqa: F401
        ai,
        audit,
        catalog,
        circulation,
        setting,
        user,
    )


# Eagerly load on package import too (convenient for scripts / REPL).
load_all()

from app.models.ai import (  # noqa: E402
    ChatMessage,
    ChatSession,
    KnowledgeChunk,
    KnowledgeDocument,
    SearchLog,
)
from app.models.audit import AuditLog  # noqa: E402
from app.models.catalog import (  # noqa: E402
    Author,
    Book,
    BookAuthor,
    BookCopy,
    BookEmbedding,
    Category,
    Publisher,
)
from app.models.circulation import Fine, FinePayment, Loan  # noqa: E402
from app.models.setting import LibrarySetting  # noqa: E402
from app.models.user import Department, RefreshToken, User  # noqa: E402

__all__ = [
    "AuditLog",
    "Author",
    "Book",
    "BookAuthor",
    "BookCopy",
    "BookEmbedding",
    "Category",
    "ChatMessage",
    "ChatSession",
    "Department",
    "Fine",
    "FinePayment",
    "KnowledgeChunk",
    "KnowledgeDocument",
    "LibrarySetting",
    "Loan",
    "Publisher",
    "RefreshToken",
    "SearchLog",
    "User",
    "load_all",
]
