"""Seed the database with fictional demo data.

Usage:
    python -m scripts.seed          # create if empty
    python -m scripts.seed --reset  # wipe demo tables first
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.ai import (
    ChatMessage,
    ChatSession,
    KnowledgeChunk,
    KnowledgeDocument,
    SearchLog,
)
from app.models.audit import AuditLog
from app.models.catalog import (
    Author,
    Book,
    BookAuthor,
    BookCopy,
    BookEmbedding,
    Category,
    Publisher,
)
from app.models.circulation import Fine, FinePayment, Loan
from app.models.enums import CopyStatus, Role, UserStatus
from app.models.user import Department, RefreshToken, User
from app.services import knowledge_service, search_service
from sqlalchemy import delete, select

from scripts import seed_data

DEMO_PASSWORD = "Password123"


def _reset(db) -> None:
    for model in (
        ChatMessage, ChatSession, SearchLog, KnowledgeChunk, KnowledgeDocument,
        FinePayment, Fine, Loan, BookEmbedding, BookAuthor, BookCopy, Book,
        Author, Category, Publisher, AuditLog, RefreshToken, User, Department,
    ):
        db.execute(delete(model))
    db.commit()
    print("Existing demo data cleared.")


def _seed(db) -> None:
    if db.scalar(select(User).limit(1)):
        print("Database already has users; nothing to do. Use --reset to rebuild.")
        return

    depts = {
        code: Department(name=name, code=code)
        for name, code in seed_data.DEPARTMENTS
    }
    db.add_all(depts.values())
    db.flush()

    pub_by_name = {
        name: Publisher(name=name) for name in seed_data.PUBLISHERS
    }
    db.add_all(pub_by_name.values())
    db.flush()

    users: dict[str, User] = {}
    for email, name, role, dept_code, ident in seed_data.USERS:
        u = User(
            email=email,
            full_name=name,
            role=Role(role),
            status=UserStatus.ACTIVE,
            identifier=ident,
            email_verified=True,
            password_hash=hash_password(DEMO_PASSWORD),
            department_id=depts[dept_code].id if dept_code else None,
        )
        users[email] = u
    db.add_all(users.values())
    db.flush()

    librarian = users["librarian@kle.edu"]
    authors: dict[str, Author] = {}
    cats: dict[str, Category] = {}
    books: list[Book] = []

    for (
        title, author_names, cat_name, subject, year, pub_name, keywords, desc, copies
    ) in seed_data.BOOKS:
        cat = cats.get(cat_name)
        if cat is None:
            cat = Category(name=cat_name)
            cats[cat_name] = cat
            db.add(cat)
            db.flush()
        book = Book(
            title=title,
            subject=subject,
            publication_year=year,
            language="English",
            keywords=keywords,
            description=desc,
            category_id=cat.id,
            publisher_id=pub_by_name[pub_name].id,
            created_by=librarian.id,
            ai_tags=None,
        )
        for pos, an in enumerate(author_names, start=1):
            a = authors.get(an)
            if a is None:
                a = Author(name=an)
                authors[an] = a
                db.add(a)
                db.flush()
            book.authors.append(BookAuthor(author=a, position=pos))
        db.add(book)
        db.flush()
        for i in range(copies):
            db.add(
                BookCopy(
                    book_id=book.id,
                    barcode=f"KLE{book.publication_year}{str(book.id)[:4]}{i:02d}".upper(),
                    acquisition_date=date.today() - timedelta(days=400 - i * 10),
                    shelf_location=f"{cat_name[:3].upper()}-{year % 100:02d}",
                    status=CopyStatus.AVAILABLE,
                )
            )
        books.append(book)
    db.flush()

    for title, category, access, body in seed_data.KNOWLEDGE_DOCS:
        db.add(
            KnowledgeDocument(
                title=title,
                category=category,
                access_level=access,
                body=body.strip(),
                source="seed",
                created_by=librarian.id,
            )
        )
    db.flush()

    # A couple of demo loans so dashboards and the assistant have something to show.
    asha = users["asha@kle.edu"]
    clean_code = next(b for b in books if b.title == "Clean Code")
    copy = clean_code.copies[0]
    copy.status = CopyStatus.ISSUED
    db.add(
        Loan(
            copy_id=copy.id,
            book_id=clean_code.id,
            user_id=asha.id,
            issued_by=librarian.id,
            due_at=date.today() + timedelta(days=5),
            issued_at=date.today() - timedelta(days=9),
        )
    )
    db.commit()
    print(f"Seeded {len(books)} books, {len(users)} users, "
          f"{len(seed_data.KNOWLEDGE_DOCS)} knowledge documents.")

    print("Building AI indexes (embeddings)...")
    n_books = search_service.reindex_all(db)
    n_chunks = knowledge_service.reindex_all(db)
    db.commit()
    print(f"Indexed {n_books} books and {n_chunks} knowledge chunks.")
    print(f"\nDemo login: any address above / password '{DEMO_PASSWORD}'")
    print("e.g. librarian@kle.edu  or  asha@kle.edu")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="wipe demo data first")
    args = parser.parse_args()

    Base.metadata.create_all(engine)  # harmless if migrations already ran
    with SessionLocal() as db:
        if args.reset:
            _reset(db)
        _seed(db)


if __name__ == "__main__":
    sys.exit(main())
