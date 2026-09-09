"""ORM models.

``load_all()`` imports every model module so that ``Base.metadata`` is complete
for Alembic autogenerate and test setup.
"""

from __future__ import annotations


def load_all() -> None:
    from app.models import (  # noqa: F401
        ai,
        audit,
        catalog,
        circulation,
        engagement,
        setting,
        user,
    )


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
    Shelf,
)
from app.models.circulation import (  # noqa: E402
    Fine,
    FinePayment,
    Loan,
    Reservation,
)
from app.models.engagement import Favorite, Notification  # noqa: E402
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
    "Favorite",
    "Fine",
    "FinePayment",
    "KnowledgeChunk",
    "KnowledgeDocument",
    "LibrarySetting",
    "Loan",
    "Notification",
    "Publisher",
    "RefreshToken",
    "Reservation",
    "SearchLog",
    "Shelf",
    "User",
    "load_all",
]
