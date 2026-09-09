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
    Shelf,
)
from app.models.circulation import Fine, FinePayment, Loan, Reservation
from app.models.engagement import Favorite, Notification
from app.models.enums import CopyStatus, NotificationType, Role, UserStatus
from app.models.user import Department, RefreshToken, User
from app.services import knowledge_service, search_service
from sqlalchemy import delete, select

from scripts import seed_data

DEMO_PASSWORD = "Password123"


def _reset(db) -> None:
    for model in (
        ChatMessage, ChatSession, SearchLog, KnowledgeChunk, KnowledgeDocument,
        Notification, Favorite, Reservation, FinePayment, Fine, Loan,
        BookEmbedding, BookAuthor, BookCopy, Book, Author, Category, Publisher,
        Shelf, AuditLog, RefreshToken, User, Department,
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

    shelves = {
        s[0]: Shelf(code=s[0], name=s[1], location=s[2], capacity=s[3])
        for s in seed_data.SHELVES
    }
    db.add_all(shelves.values())
    db.flush()
    shelf_codes = list(shelves)

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
        shelf = shelves[shelf_codes[len(books) % len(shelf_codes)]]
        for i in range(copies):
            db.add(
                BookCopy(
                    book_id=book.id,
                    barcode=f"KLE{book.publication_year}{str(book.id)[:4]}{i:02d}".upper(),
                    acquisition_date=date.today() - timedelta(days=400 - i * 10),
                    shelf_id=shelf.id,
                    shelf_location=shelf.code,
                    price=round(350 + (year % 40) * 12.5, 2),
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

    # Demo circulation so dashboards, lists and the assistant have data to show.
    asha = users["asha@kle.edu"]
    vikram = users["vikram@kle.edu"]
    meera = users["meera@kle.edu"]

    def issue(book_title, member, issued_days_ago, due_in_days):
        b = next(x for x in books if x.title == book_title)
        c = next((c for c in b.copies if c.status == CopyStatus.AVAILABLE), None)
        if c is None:
            return None
        c.status = CopyStatus.ISSUED
        loan = Loan(
            copy_id=c.id, book_id=b.id, user_id=member.id, issued_by=librarian.id,
            issued_at=date.today() - timedelta(days=issued_days_ago),
            due_at=date.today() + timedelta(days=due_in_days),
        )
        db.add(loan)
        db.flush()
        return loan, b

    issue("Clean Code", asha, 9, 5)
    issue("Python Crash Course", vikram, 20, -6)  # overdue
    issue("Effective Java", meera, 3, 11)
    returned = issue("Grokking Algorithms", asha, 30, -2)
    if returned:
        loan, b = returned
        loan.status = "returned"
        loan.returned_at = date.today() - timedelta(days=1)
        for c in b.copies:
            if c.status == CopyStatus.ISSUED:
                c.status = CopyStatus.AVAILABLE

    # An overdue fine for Vikram, plus a paid one.
    from app.models.enums import FineStatus, FineType

    db.add(Fine(user_id=vikram.id, type=FineType.OVERDUE, amount=12.0,
                reason="Overdue: Python Crash Course"))
    db.add(Fine(user_id=meera.id, type=FineType.DAMAGE, amount=100.0,
                paid_amount=100.0, status=FineStatus.PAID,
                reason="Water-damaged cover"))

    # A reservation queue on a fully-issued title.
    dl = next(x for x in books if x.title == "Deep Learning")
    for c in dl.copies:
        c.status = CopyStatus.ISSUED
        db.add(Loan(copy_id=c.id, book_id=dl.id, user_id=vikram.id,
                    issued_by=librarian.id,
                    issued_at=date.today() - timedelta(days=4),
                    due_at=date.today() + timedelta(days=10)))
    db.flush()
    for pos, m in enumerate([asha, meera], start=1):
        db.add(Reservation(book_id=dl.id, user_id=m.id, queue_position=pos))

    db.add_all([
        Favorite(user_id=asha.id, book_id=b.id)
        for b in books if b.title in (
            "Deep Learning", "Fluent Python", "Designing Data-Intensive Applications"
        )
    ])
    # Flip past-due loans to OVERDUE (what the worker does hourly).
    from app.services import circulation_service

    circulation_service.mark_overdue(db)

    db.add_all([
        Notification(
            user_id=asha.id, type=NotificationType.RECOMMENDATION,
            title="New arrivals in Artificial Intelligence",
            body="3 new titles were added this week.", link="/catalogue",
        ),
        Notification(
            user_id=vikram.id, type=NotificationType.OVERDUE,
            title="'Python Crash Course' is overdue",
            body="Please return it to avoid further fines.", link="/my-loans",
        ),
    ])

    db.commit()
    print(f"Seeded {len(books)} books, {len(users)} users, "
          f"{len(shelves)} shelves, {len(seed_data.KNOWLEDGE_DOCS)} knowledge docs.")

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
