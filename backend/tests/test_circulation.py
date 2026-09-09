from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from tests.conftest import auth_headers


def _first_available_book(client, headers):
    page = client.get("/api/v1/books?available_only=true", headers=headers).json()
    return page["items"][0]["id"]


def test_issue_and_return_flow(client):
    lib = auth_headers(client, "librarian@kle.edu")
    stu = auth_headers(client, "vikram@kle.edu")
    member = client.get("/api/v1/auth/me", headers=stu).json()
    book_id = _first_available_book(client, stu)

    issued = client.post(
        "/api/v1/issues",
        json={"member_id": member["id"], "book_id": book_id},
        headers=lib,
    )
    assert issued.status_code == 201, issued.text
    loan = issued.json()
    assert loan["status"] == "active"

    mine = client.get("/api/v1/me/loans?active_only=true", headers=stu).json()
    assert any(item["id"] == loan["id"] for item in mine["items"])

    returned = client.post(
        "/api/v1/returns", json={"loan_id": loan["id"]}, headers=lib
    )
    assert returned.status_code == 200
    assert returned.json()["fine"] is None


def test_overdue_return_creates_fine(client, db):
    from app.models.circulation import Loan

    lib = auth_headers(client, "librarian@kle.edu")
    stu = auth_headers(client, "meera@kle.edu")
    member = client.get("/api/v1/auth/me", headers=stu).json()
    book_id = _first_available_book(client, stu)

    loan_id = client.post(
        "/api/v1/issues",
        json={"member_id": member["id"], "book_id": book_id},
        headers=lib,
    ).json()["id"]

    # Backdate the due date by 10 days.
    loan = db.get(Loan, uuid.UUID(loan_id))
    loan.due_at = datetime.now(UTC) - timedelta(days=10)
    db.commit()

    result = client.post(
        "/api/v1/returns", json={"loan_id": loan_id}, headers=lib
    ).json()
    assert result["fine"] is not None
    assert result["fine"]["type"] == "overdue"
    assert result["fine"]["amount"] > 0


def test_borrow_limit_enforced(client, db):
    from app.services import settings_service

    settings_service.set_value(
        db, "borrow_limit", {"student": 1, "faculty": 10, "librarian": 10, "admin": 10}
    )
    db.commit()

    lib = auth_headers(client, "librarian@kle.edu")
    stu = auth_headers(client, "john@kle.edu")
    member = client.get("/api/v1/auth/me", headers=stu).json()

    books = client.get(
        "/api/v1/books?available_only=true&page_size=5", headers=stu
    ).json()["items"]
    first = client.post(
        "/api/v1/issues",
        json={"member_id": member["id"], "book_id": books[0]["id"]},
        headers=lib,
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/issues",
        json={"member_id": member["id"], "book_id": books[1]["id"]},
        headers=lib,
    )
    assert second.status_code == 422
    assert second.json()["error"]["code"] == "business_rule_violation"

    settings_service.set_value(
        db, "borrow_limit",
        {"student": 4, "faculty": 10, "librarian": 10, "admin": 10},
    )
    db.commit()
