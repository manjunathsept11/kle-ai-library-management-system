from __future__ import annotations

from tests.conftest import auth_headers


def test_list_and_get_book(client):
    h = auth_headers(client, "asha@kle.edu")
    page = client.get("/api/v1/books?q=python", headers=h).json()
    assert page["total"] >= 1
    book_id = page["items"][0]["id"]
    detail = client.get(f"/api/v1/books/{book_id}", headers=h).json()
    assert detail["id"] == book_id
    assert "copies" in detail
    assert detail["total_copies"] >= 1


def test_student_cannot_create_book(client):
    h = auth_headers(client, "asha@kle.edu")
    resp = client.post(
        "/api/v1/books", json={"title": "Hack Attempt"}, headers=h
    )
    assert resp.status_code == 403


def test_librarian_creates_book_with_copies(client):
    h = auth_headers(client, "librarian@kle.edu")
    resp = client.post(
        "/api/v1/books",
        json={
            "title": "Test-Driven Development",
            "authors": ["Kent Beck"],
            "category_name": "Software Engineering",
            "publication_year": 2002,
            "initial_copies": 2,
        },
        headers=h,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["total_copies"] == 2
    assert body["available_copies"] == 2
    assert body["author_names"] == ["Kent Beck"]


def test_duplicate_isbn_rejected(client):
    h = auth_headers(client, "librarian@kle.edu")
    payload = {"title": "ISBN Book A", "isbn": "978-0-00-000001-0"}
    assert client.post("/api/v1/books", json=payload, headers=h).status_code == 201
    dupe = client.post(
        "/api/v1/books", json={"title": "ISBN Book B", "isbn": "978-0-00-000001-0"},
        headers=h,
    )
    assert dupe.status_code == 409
