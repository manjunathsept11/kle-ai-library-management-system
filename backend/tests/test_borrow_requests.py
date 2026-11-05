from __future__ import annotations

from tests.conftest import auth_headers


def _available_books(client, headers):
    return [b["id"] for b in client.get("/api/v1/books?available_only=true", headers=headers).json()["items"]]


def test_admin_creates_user_then_request_approve_reject(client):
    admin = auth_headers(client, "admin@kle.edu")
    lib = auth_headers(client, "librarian@kle.edu")

    # A fresh student keeps this test independent of the seeded loans.
    created = client.post(
        "/api/v1/admin/users",
        json={"email": "req.student@kle.edu", "full_name": "Req Student",
              "role": "student", "password": "Password123"},
        headers=admin,
    )
    assert created.status_code == 201, created.text
    stu = auth_headers(client, "req.student@kle.edu")
    book_id, other = _available_books(client, stu)[:2]

    r = client.post("/api/v1/borrow-requests", json={"book_id": book_id, "note": "exam"}, headers=stu)
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["status"] == "pending"

    assert client.post("/api/v1/borrow-requests", json={"book_id": book_id}, headers=stu).status_code == 409
    assert client.post(f"/api/v1/borrow-requests/{req['id']}/approve", headers=stu).status_code == 403

    ok = client.post(f"/api/v1/borrow-requests/{req['id']}/approve", headers=lib)
    assert ok.status_code == 200, ok.text
    assert ok.json()["status"] == "approved"
    loans = client.get("/api/v1/me/loans?active_only=true", headers=stu).json()["items"]
    assert any(item["book"]["id"] == book_id for item in loans)

    # already decided
    assert client.post(f"/api/v1/borrow-requests/{req['id']}/reject", json={}, headers=lib).status_code == 422

    r2 = client.post("/api/v1/borrow-requests", json={"book_id": other}, headers=stu).json()
    rej = client.post(f"/api/v1/borrow-requests/{r2['id']}/reject", json={"reason": "reference only"}, headers=lib)
    assert rej.json()["status"] == "rejected"
    assert rej.json()["decision_note"] == "reference only"
