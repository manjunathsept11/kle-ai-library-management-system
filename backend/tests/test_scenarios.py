"""Broad scenario coverage across every role: RBAC, admin, circulation, fines,
reservations, borrow requests, engagement, taxonomy, reports.

Each test makes its own fresh member via the admin API, so it does not depend on
(or disturb) the seeded loans.
"""

from __future__ import annotations

import itertools
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from tests.conftest import auth_headers

API = "/api/v1"
_n = itertools.count(1)


def H(client, email):
    return auth_headers(client, email)


def make_user(client, role="student", password="Password123", **extra):
    admin = H(client, "admin@kle.edu")
    email = f"scn{next(_n)}.{uuid.uuid4().hex[:6]}@kle.edu"
    r = client.post(
        f"{API}/admin/users",
        json={"email": email, "full_name": "Scenario User", "role": role,
              "password": password, **extra},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    return r.json(), H(client, email) if password == "Password123" else None


def avail_books(client, h, n=3):
    items = client.get(f"{API}/books?available_only=true&page_size=50", headers=h).json()["items"]
    return [b["id"] for b in items][:n]


def issue(client, lib, member_id, book_id):
    return client.post(f"{API}/issues", json={"member_id": member_id, "book_id": book_id}, headers=lib)


# ---------------------------------------------------------------- RBAC matrix

STAFF_ONLY = [
    ("GET", "/borrow-requests"), ("GET", "/reservations"), ("GET", "/loans"),
    ("GET", "/fines"), ("POST", "/issues"), ("POST", "/returns"),
    ("POST", "/books"), ("GET", "/reports/overdue"), ("GET", "/reports/inventory"),
    ("GET", "/reports/most-borrowed"), ("GET", "/reports/circulation"),
    ("POST", "/shelves"), ("POST", "/categories"), ("POST", "/announcements"),
    ("GET", "/copies"),
]
ADMIN_ONLY = [
    ("GET", "/admin/users"), ("POST", "/admin/users"), ("GET", "/admin/departments"),
    ("GET", "/admin/settings"), ("GET", "/admin/audit"),
]


@pytest.mark.parametrize("method,path", STAFF_ONLY + ADMIN_ONLY)
def test_unauthenticated_is_401(client, method, path):
    assert client.request(method, API + path).status_code == 401


@pytest.mark.parametrize("method,path", STAFF_ONLY + ADMIN_ONLY)
def test_student_and_faculty_forbidden(client, method, path):
    for email in ("meera@kle.edu", "prof.rao@kle.edu"):
        r = client.request(method, API + path, headers=H(client, email), json={})
        assert r.status_code == 403, (email, method, path, r.status_code)


@pytest.mark.parametrize("method,path", ADMIN_ONLY)
def test_librarian_forbidden_from_admin_console(client, method, path):
    r = client.request(method, API + path, headers=H(client, "librarian@kle.edu"), json={})
    assert r.status_code == 403


@pytest.mark.parametrize("method,path", [m for m in STAFF_ONLY if m[0] == "GET"])
def test_staff_can_read_staff_endpoints(client, method, path):
    for email in ("librarian@kle.edu", "admin@kle.edu"):
        assert client.get(API + path, headers=H(client, email)).status_code == 200


# ---------------------------------------------------------------- auth & accounts

def test_lockout_after_repeated_failures(client):
    user, _ = make_user(client)
    for _i in range(12):
        client.post(f"{API}/auth/login", json={"email": user["email"], "password": "nope-nope"})
    ok = client.post(f"{API}/auth/login", json={"email": user["email"], "password": "Password123"})
    assert ok.status_code in (401, 403, 423, 429), "locked account must refuse even the right password"


def test_suspended_user_cannot_login_or_use_token(client):
    user, stu = make_user(client)
    admin = H(client, "admin@kle.edu")
    r = client.patch(f"{API}/admin/users/{user['id']}", json={"status": "suspended"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "suspended"
    assert client.get(f"{API}/auth/me", headers=stu).status_code in (401, 403)
    login = client.post(f"{API}/auth/login", json={"email": user["email"], "password": "Password123"})
    assert login.status_code in (401, 403)
    client.patch(f"{API}/admin/users/{user['id']}", json={"status": "active"}, headers=admin)
    assert client.post(f"{API}/auth/login", json={"email": user["email"], "password": "Password123"}).status_code == 200


def test_password_change_and_admin_reset(client):
    user, stu = make_user(client)
    bad = client.post(f"{API}/auth/me/password", json={"current_password": "wrong", "new_password": "Another123"}, headers=stu)
    assert bad.status_code in (400, 401, 403, 422)
    ok = client.post(f"{API}/auth/me/password", json={"current_password": "Password123", "new_password": "Another123"}, headers=stu)
    assert ok.status_code == 200, ok.text
    assert client.post(f"{API}/auth/login", json={"email": user["email"], "password": "Password123"}).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": user["email"], "password": "Another123"}).status_code == 200

    admin = H(client, "admin@kle.edu")
    short = client.post(f"{API}/admin/users/{user['id']}/reset-password", json={"new_password": "short"}, headers=admin)
    assert short.status_code == 422
    rst = client.post(f"{API}/admin/users/{user['id']}/reset-password", json={"new_password": "Reset12345"}, headers=admin)
    assert rst.status_code == 200
    assert client.post(f"{API}/auth/login", json={"email": user["email"], "password": "Reset12345"}).status_code == 200


def test_profile_update(client):
    _, stu = make_user(client)
    r = client.patch(f"{API}/auth/me", json={"full_name": "Renamed Person", "phone": "9999999999"}, headers=stu)
    assert r.status_code == 200 and r.json()["full_name"] == "Renamed Person"


def test_register_duplicate_and_logout(client):
    body = {"email": f"dup{uuid.uuid4().hex[:5]}@kle.edu", "password": "Password123", "full_name": "Dup Person"}
    assert client.post(f"{API}/auth/register", json=body).status_code in (200, 201)
    assert client.post(f"{API}/auth/register", json=body).status_code == 409
    tok = client.post(f"{API}/auth/login", json={"email": body["email"], "password": body["password"]}).json()
    out = client.post(f"{API}/auth/logout", json={"refresh_token": tok["refresh_token"]},
                      headers={"Authorization": f"Bearer {tok['access_token']}"})
    assert out.status_code in (200, 204)
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": tok["refresh_token"]}).status_code == 401


# ---------------------------------------------------------------- admin console

def test_admin_user_management(client):
    admin = H(client, "admin@kle.edu")
    user, _ = make_user(client)
    dup = client.post(f"{API}/admin/users", json={"email": user["email"], "full_name": "Again", "role": "student", "password": "Password123"}, headers=admin)
    assert dup.status_code == 409
    bad_role = client.post(f"{API}/admin/users", json={"email": "x@kle.edu", "full_name": "Bad Role", "role": "wizard", "password": "Password123"}, headers=admin)
    assert bad_role.status_code == 422

    upd = client.patch(f"{API}/admin/users/{user['id']}", json={"role": "faculty", "borrow_limit_override": 1, "staff_notes": "VIP"}, headers=admin)
    assert upd.status_code == 200
    assert (upd.json()["role"], upd.json()["borrow_limit_override"], upd.json()["staff_notes"]) == ("faculty", 1, "VIP")
    clr = client.patch(f"{API}/admin/users/{user['id']}", json={"borrow_limit_override": None}, headers=admin)
    assert clr.json()["borrow_limit_override"] is None

    by_role = client.get(f"{API}/admin/users?role=librarian", headers=admin).json()
    assert by_role["total"] >= 1 and all(u["role"] == "librarian" for u in by_role["items"])
    found = client.get(f"{API}/admin/users?q={user['email']}", headers=admin).json()
    assert found["total"] == 1
    assert client.get(f"{API}/admin/users/{uuid.uuid4()}", headers=admin).status_code == 404
    assert client.get(f"{API}/admin/users?page_size=1000", headers=admin).status_code == 422


def test_borrow_limit_override_applies(client):
    user, _ = make_user(client)
    admin, lib = H(client, "admin@kle.edu"), H(client, "librarian@kle.edu")
    client.patch(f"{API}/admin/users/{user['id']}", json={"borrow_limit_override": 1}, headers=admin)
    a, b = avail_books(client, lib, 2)
    assert issue(client, lib, user["id"], a).status_code == 201
    second = issue(client, lib, user["id"], b)
    assert second.status_code == 422 and "limit" in second.text.lower()


def test_departments_crud(client):
    admin = H(client, "admin@kle.edu")
    code = "T" + uuid.uuid4().hex[:5].upper()
    d = client.post(f"{API}/admin/departments", json={"name": f"Dept {code}", "code": code}, headers=admin)
    assert d.status_code in (200, 201), d.text
    did = d.json()["id"]
    assert client.post(f"{API}/admin/departments", json={"name": "Other", "code": code}, headers=admin).status_code == 409
    assert client.patch(f"{API}/admin/departments/{did}", json={"name": "Renamed Dept", "code": code}, headers=admin).status_code == 200
    user, _ = make_user(client, department_id=did)
    assert client.delete(f"{API}/admin/departments/{did}", headers=admin).status_code in (409, 422), "dept with members must not be deletable"
    client.patch(f"{API}/admin/users/{user['id']}", json={"department_id": None}, headers=admin)
    assert client.delete(f"{API}/admin/departments/{did}", headers=admin).status_code in (200, 204)


def test_settings_change_takes_effect_and_is_audited(client):
    admin, lib = H(client, "admin@kle.edu"), H(client, "librarian@kle.edu")
    cur = client.get(f"{API}/admin/settings", headers=admin).json()
    assert "borrow_limit" in str(cur)
    assert client.put(f"{API}/admin/settings", json={"key": "not_a_real_key", "value": 1}, headers=admin).status_code in (400, 404, 422)

    user, _ = make_user(client)
    a, b = avail_books(client, lib, 2)
    old = client.get(f"{API}/admin/settings", headers=admin).json()
    values = old.get("values", old)
    limits = dict(values["borrow_limit"])
    try:
        limits["student"] = 1
        r = client.put(f"{API}/admin/settings", json={"key": "borrow_limit", "value": limits}, headers=admin)
        assert r.status_code == 200, r.text
        assert issue(client, lib, user["id"], a).status_code == 201
        assert issue(client, lib, user["id"], b).status_code == 422
    finally:
        limits["student"] = values["borrow_limit"]["student"]
        client.put(f"{API}/admin/settings", json={"key": "borrow_limit", "value": limits}, headers=admin)
    audit = client.get(f"{API}/admin/audit", headers=admin).json()
    assert audit["total"] > 0


# ---------------------------------------------------------------- circulation

def test_issue_edge_cases(client):
    lib = H(client, "librarian@kle.edu")
    user, _ = make_user(client)
    assert issue(client, lib, str(uuid.uuid4()), avail_books(client, lib, 1)[0]).status_code == 404
    assert issue(client, lib, user["id"], str(uuid.uuid4())).status_code in (404, 422)
    assert client.post(f"{API}/issues", json={"member_id": user["id"]}, headers=lib).status_code in (400, 422)


def test_return_edge_cases_and_copy_barcode_return(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    book = avail_books(client, lib, 1)[0]
    loan = issue(client, lib, user["id"], book).json()
    assert client.post(f"{API}/returns", json={"copy_id": loan["copy_id"]}, headers=lib).status_code == 200
    again = client.post(f"{API}/returns", json={"loan_id": loan["id"]}, headers=lib)
    assert again.status_code == 422
    assert client.post(f"{API}/returns", json={}, headers=lib).status_code in (400, 422)
    assert client.post(f"{API}/returns", json={"loan_id": str(uuid.uuid4())}, headers=lib).status_code == 404


def test_renew_rules(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    loan = issue(client, lib, user["id"], avail_books(client, lib, 1)[0]).json()
    due0 = datetime.fromisoformat(loan["due_at"])
    for i in (1, 2):
        r = client.post(f"{API}/loans/{loan['id']}/renew", headers=stu)
        assert r.status_code == 200, r.text
        assert r.json()["loan"]["renewed_count"] == i
    assert datetime.fromisoformat(r.json()["loan"]["due_at"]) > due0
    third = client.post(f"{API}/loans/{loan['id']}/renew", headers=stu)
    assert third.status_code == 422
    # someone else's loan cannot be renewed by a different student
    _, other = make_user(client)
    assert client.post(f"{API}/loans/{loan['id']}/renew", headers=other).status_code in (403, 404, 422)


def test_loan_listing_filters_and_scoping(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    loan = issue(client, lib, user["id"], avail_books(client, lib, 1)[0]).json()
    mine = client.get(f"{API}/me/loans", headers=stu).json()
    assert mine["total"] == 1
    active = client.get(f"{API}/loans?member_id={user['id']}&active_only=true", headers=lib).json()
    assert active["total"] == 1
    client.post(f"{API}/returns", json={"loan_id": loan["id"]}, headers=lib)
    assert client.get(f"{API}/loans?member_id={user['id']}&active_only=true", headers=lib).json()["total"] == 0
    assert client.get(f"{API}/loans?member_id={user['id']}", headers=lib).json()["total"] == 1
    # a different student's /me/loans never contains it
    _, other = make_user(client)
    assert client.get(f"{API}/me/loans", headers=other).json()["total"] == 0


def test_overdue_marking_and_report(client, db):
    from app.models.circulation import Loan
    from app.services import circulation_service

    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    loan = issue(client, lib, user["id"], avail_books(client, lib, 1)[0]).json()
    row = db.get(Loan, uuid.UUID(loan["id"]))
    row.due_at = datetime.now(UTC) - timedelta(days=3)
    db.commit()
    circulation_service.mark_overdue(db)
    db.commit()
    ov = client.get(f"{API}/reports/overdue", headers=lib).json()
    assert any(user["email"] in str(x) or loan["id"] in str(x) for x in (ov if isinstance(ov, list) else ov.get("items", ov)))
    assert client.get(f"{API}/me/loans", headers=stu).json()["items"][0]["status"] == "overdue"


# ---------------------------------------------------------------- fines

def test_fine_lifecycle_partial_full_waive_and_block(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    mk = lambda amt: client.post(f"{API}/fines", json={"member_id": user["id"], "type": "damage", "amount": amt, "reason": "torn pages"}, headers=lib)  # noqa: E731
    f = mk(100)
    assert f.status_code in (200, 201), f.text
    fid = f.json()["id"]
    assert client.post(f"{API}/fines", json={"member_id": user["id"], "type": "damage", "amount": -5, "reason": "bad"}, headers=lib).status_code == 422

    part = client.post(f"{API}/fines/{fid}/payment", json={"amount": 40, "method": "cash"}, headers=lib)
    assert part.status_code == 200, part.text
    assert client.post(f"{API}/fines/{fid}/payment", json={"amount": 9999, "method": "cash"}, headers=lib).status_code == 422
    assert client.post(f"{API}/fines/{fid}/payment", json={"amount": 0, "method": "cash"}, headers=lib).status_code == 422
    full = client.post(f"{API}/fines/{fid}/payment", json={"amount": 60, "method": "upi"}, headers=lib)
    assert full.status_code == 200
    mine = client.get(f"{API}/me/fines", headers=stu).json()
    assert mine[0]["status"] == "paid" and mine[0]["paid_amount"] == 100
    assert client.post(f"{API}/fines/{fid}/payment", json={"amount": 1, "method": "cash"}, headers=lib).status_code == 422

    # a large fine blocks borrowing; waiving it restores access
    big = mk(400).json()["id"]
    assert client.get(f"{API}/me/borrowing-status", headers=stu).json()["can_borrow"] is False
    book = avail_books(client, lib, 1)[0]
    assert issue(client, lib, user["id"], book).status_code == 422
    assert client.post(f"{API}/fines/{big}/waive", json={"reason": "x"}, headers=lib).status_code == 422
    assert client.post(f"{API}/fines/{big}/waive", json={"reason": "goodwill waiver"}, headers=lib).status_code == 200
    assert client.get(f"{API}/me/borrowing-status", headers=stu).json()["can_borrow"] is True
    assert issue(client, lib, user["id"], book).status_code == 201
    assert client.get(f"{API}/fines?status=waived", headers=lib).json()["total"] >= 1


def test_student_cannot_pay_or_waive(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    fid = client.post(f"{API}/fines", json={"member_id": user["id"], "type": "damage", "amount": 50, "reason": "stain"}, headers=lib).json()["id"]
    assert client.post(f"{API}/fines/{fid}/payment", json={"amount": 50}, headers=stu).status_code == 403
    assert client.post(f"{API}/fines/{fid}/waive", json={"reason": "please"}, headers=stu).status_code == 403


# ---------------------------------------------------------------- reservations

def _fully_issued_book(client, lib):
    """Create a 1-copy book and issue its only copy, returning (book_id, loan, borrower)."""
    owner, owner_h = make_user(client)
    isbn = "9" + uuid.uuid4().int.__str__()[:12]
    b = client.post(f"{API}/books", json={"title": f"Scarce {uuid.uuid4().hex[:6]}", "isbn": isbn, "author_names": ["A. Writer"], "initial_copies": 1}, headers=lib)
    assert b.status_code == 201, b.text
    book_id = b.json()["id"]
    loan = issue(client, lib, owner["id"], book_id).json()
    return book_id, loan, owner


def test_reservation_queue_promotion_and_fulfilment(client):
    lib = H(client, "librarian@kle.edu")
    book_id, loan, _ = _fully_issued_book(client, lib)
    u1, h1 = make_user(client)
    u2, h2 = make_user(client)

    # cannot reserve something that's available, only when out
    assert client.post(f"{API}/reservations", json={"book_id": avail_books(client, lib, 1)[0]}, headers=h1).status_code == 422
    r1 = client.post(f"{API}/reservations", json={"book_id": book_id}, headers=h1)
    r2 = client.post(f"{API}/reservations", json={"book_id": book_id}, headers=h2)
    assert (r1.status_code, r2.status_code) == (201, 201)
    assert (r1.json()["queue_position"], r2.json()["queue_position"]) == (1, 2)
    assert client.post(f"{API}/reservations", json={"book_id": book_id}, headers=h1).status_code == 409

    # return promotes #1 to READY and notifies them
    client.post(f"{API}/returns", json={"loan_id": loan["id"]}, headers=lib)
    mine = client.get(f"{API}/me/reservations", headers=h1).json()
    assert mine[0]["status"] == "ready"
    assert client.get(f"{API}/me/reservations", headers=h2).json()[0]["status"] == "pending"
    notes = client.get(f"{API}/me/notifications", headers=h1).json()
    assert any("ready" in n["title"].lower() for n in notes["items"])

    # issuing to #1 fulfils it; #2 cancels cleanly
    assert issue(client, lib, u1["id"], book_id).status_code == 201
    assert client.get(f"{API}/me/reservations", headers=h1).json()[0]["status"] == "fulfilled"
    rid = client.get(f"{API}/me/reservations", headers=h2).json()[0]["id"]
    assert client.delete(f"{API}/reservations/{rid}", headers=h1).status_code in (403, 422), "cannot cancel someone else's"
    assert client.delete(f"{API}/reservations/{rid}", headers=h2).status_code == 200
    assert client.delete(f"{API}/reservations/{rid}", headers=h2).status_code == 422


# ---------------------------------------------------------------- borrow requests

def test_borrow_request_edge_cases(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    other, oth = make_user(client)
    book = avail_books(client, lib, 1)[0]

    assert client.post(f"{API}/borrow-requests", json={"book_id": str(uuid.uuid4())}, headers=stu).status_code == 404
    req = client.post(f"{API}/borrow-requests", json={"book_id": book}, headers=stu).json()
    assert client.delete(f"{API}/borrow-requests/{req['id']}", headers=oth).status_code == 422, "not yours"
    assert client.delete(f"{API}/borrow-requests/{req['id']}", headers=stu).json()["status"] == "cancelled"
    assert client.post(f"{API}/borrow-requests/{req['id']}/approve", headers=lib).status_code == 422, "cancelled cannot be approved"
    assert client.post(f"{API}/borrow-requests/{uuid.uuid4()}/approve", headers=lib).status_code == 404

    # once cancelled, a new one is allowed again
    again = client.post(f"{API}/borrow-requests", json={"book_id": book}, headers=stu)
    assert again.status_code == 201

    # staff list: scoped by status, hidden from students
    pend = client.get(f"{API}/borrow-requests?status=pending", headers=lib).json()
    assert any(r["id"] == again.json()["id"] for r in pend["items"])
    assert client.get(f"{API}/borrow-requests", headers=stu).status_code == 403
    # students never see each other's requests
    assert client.get(f"{API}/me/borrow-requests", headers=oth).json() == []
    # student cannot decide
    assert client.post(f"{API}/borrow-requests/{again.json()['id']}/reject", json={}, headers=stu).status_code == 403


def test_borrow_request_blocked_when_unavailable_or_fined(client):
    lib = H(client, "librarian@kle.edu")
    book_id, _, _ = _fully_issued_book(client, lib)
    user, stu = make_user(client)
    assert client.post(f"{API}/borrow-requests", json={"book_id": book_id}, headers=stu).status_code == 422

    client.post(f"{API}/fines", json={"member_id": user["id"], "type": "lost", "amount": 500, "reason": "lost item"}, headers=lib)
    assert client.post(f"{API}/borrow-requests", json={"book_id": avail_books(client, lib, 1)[0]}, headers=stu).status_code == 422


def test_approve_fails_if_member_hit_limit_after_requesting(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    admin = H(client, "admin@kle.edu")
    client.patch(f"{API}/admin/users/{user['id']}", json={"borrow_limit_override": 1}, headers=admin)
    a, b = avail_books(client, lib, 2)
    req = client.post(f"{API}/borrow-requests", json={"book_id": a}, headers=stu).json()
    assert issue(client, lib, user["id"], b).status_code == 201  # desk issue fills the limit
    r = client.post(f"{API}/borrow-requests/{req['id']}/approve", headers=lib)
    assert r.status_code == 422 and "limit" in r.text.lower()
    # request stays pending so the librarian can decline it with a reason
    assert client.get(f"{API}/me/borrow-requests", headers=stu).json()[0]["status"] == "pending"
    assert client.post(f"{API}/borrow-requests/{req['id']}/reject", json={"reason": "limit"}, headers=lib).status_code == 200


def test_approval_notifies_student_and_staff_are_notified_of_request(client):
    lib = H(client, "librarian@kle.edu")
    user, stu = make_user(client)
    before = client.get(f"{API}/me/notifications", headers=lib).json()["unread"]
    req = client.post(f"{API}/borrow-requests", json={"book_id": avail_books(client, lib, 1)[0]}, headers=stu).json()
    assert client.get(f"{API}/me/notifications", headers=lib).json()["unread"] == before + 1
    client.post(f"{API}/borrow-requests/{req['id']}/approve", headers=lib)
    titles = [n["title"] for n in client.get(f"{API}/me/notifications", headers=stu).json()["items"]]
    assert any(t.startswith("Approved") for t in titles)


# ---------------------------------------------------------------- engagement

def test_favorites_idempotent(client):
    _, stu = make_user(client)
    book = avail_books(client, stu, 1)[0]
    assert client.put(f"{API}/me/favorites/{book}", headers=stu).status_code in (200, 201, 204)
    assert client.put(f"{API}/me/favorites/{book}", headers=stu).status_code in (200, 201, 204)
    assert len(client.get(f"{API}/me/favorites", headers=stu).json()) == 1
    assert client.delete(f"{API}/me/favorites/{book}", headers=stu).status_code in (200, 204)
    assert client.delete(f"{API}/me/favorites/{book}", headers=stu).status_code in (200, 204, 404)
    assert client.get(f"{API}/me/favorites", headers=stu).json() == []
    assert client.put(f"{API}/me/favorites/{uuid.uuid4()}", headers=stu).status_code == 404


def test_notifications_read_flow_and_announcements(client):
    lib = H(client, "librarian@kle.edu")
    _, stu = make_user(client)
    assert client.post(f"{API}/announcements", json={"title": "Hello all"}, headers=stu).status_code == 403
    sent = client.post(f"{API}/announcements", json={"title": "Library closed Friday", "body": "Maintenance", "audience": "students"}, headers=lib)
    assert sent.status_code in (200, 201), sent.text
    n = client.get(f"{API}/me/notifications", headers=stu).json()
    assert n["unread"] >= 1
    first = n["items"][0]["id"]
    assert client.post(f"{API}/me/notifications/{first}/read", headers=stu).status_code == 200
    assert client.get(f"{API}/me/notifications", headers=stu).json()["unread"] == n["unread"] - 1
    assert client.post(f"{API}/me/notifications/read-all", headers=stu).status_code == 200
    assert client.get(f"{API}/me/notifications", headers=stu).json()["unread"] == 0


# ---------------------------------------------------------------- catalogue management

def test_book_update_copies_and_archive_rules(client):
    lib = H(client, "librarian@kle.edu")
    isbn = "9" + uuid.uuid4().int.__str__()[:12]
    b = client.post(f"{API}/books", json={"title": "Temp Book", "isbn": isbn, "author_names": ["Z"], "initial_copies": 1}, headers=lib).json()
    bid = b["id"]
    up = client.put(f"{API}/books/{bid}", json={"title": "Temp Book v2", "edition": "2nd"}, headers=lib)
    assert up.status_code == 200 and up.json()["title"] == "Temp Book v2"
    assert client.post(f"{API}/books/{bid}/copies", json={"count": 2}, headers=lib).status_code in (200, 201)
    assert client.get(f"{API}/books/{bid}", headers=lib).json()["total_copies"] == 3
    assert client.post(f"{API}/books/{bid}/copies", json={"count": 0}, headers=lib).status_code == 422

    member, _ = make_user(client)
    loan = issue(client, lib, member["id"], bid).json()
    assert client.delete(f"{API}/books/{bid}", headers=lib).status_code == 422, "cannot archive while on loan"
    client.post(f"{API}/returns", json={"loan_id": loan["id"]}, headers=lib)
    assert client.delete(f"{API}/books/{bid}", headers=lib).status_code in (200, 204)
    assert client.get(f"{API}/books/{bid}", headers=lib).status_code in (404, 200)
    assert all(x["id"] != bid for x in client.get(f"{API}/books?q=Temp+Book+v2", headers=lib).json()["items"])


def test_copy_status_change_removes_from_availability(client):
    lib = H(client, "librarian@kle.edu")
    isbn = "9" + uuid.uuid4().int.__str__()[:12]
    bid = client.post(f"{API}/books", json={"title": "One Copy Wonder", "isbn": isbn, "author_names": ["Q"], "initial_copies": 1}, headers=lib).json()["id"]
    copy = client.get(f"{API}/copies?book_id={bid}", headers=lib).json()
    copy = (copy["items"] if isinstance(copy, dict) else copy)[0]
    assert client.patch(f"{API}/copies/{copy['id']}", json={"status": "damaged"}, headers=lib).status_code == 200
    assert client.get(f"{API}/books/{bid}", headers=lib).json()["available_copies"] == 0
    member, _ = make_user(client)
    assert issue(client, lib, member["id"], bid).status_code == 422


def test_taxonomy_and_shelves(client):
    lib = H(client, "librarian@kle.edu")
    code = "S" + uuid.uuid4().hex[:6].upper()
    sh = client.post(f"{API}/shelves", json={"code": code, "name": "Test shelf", "capacity": 10}, headers=lib)
    assert sh.status_code in (200, 201), sh.text
    sid = sh.json()["id"]
    assert client.post(f"{API}/shelves", json={"code": code, "name": "Dup"}, headers=lib).status_code == 409
    assert client.patch(f"{API}/shelves/{sid}", json={"name": "Renamed shelf"}, headers=lib).status_code == 200
    assert client.delete(f"{API}/shelves/{sid}", headers=lib).status_code in (200, 204)

    cat = client.post(f"{API}/categories", json={"name": f"Cat {code}"}, headers=lib)
    assert cat.status_code in (200, 201)
    cid = cat.json()["id"]
    assert client.patch(f"{API}/categories/{cid}", json={"name": f"Cat2 {code}"}, headers=lib).status_code == 200
    assert client.delete(f"{API}/categories/{cid}", headers=lib).status_code in (200, 204)
    # seeded category is in use -> cannot be deleted
    used = client.get(f"{API}/categories", headers=lib).json()
    in_use = next(c for c in used if c.get("book_count", 0) > 0)
    assert client.delete(f"{API}/categories/{in_use['id']}", headers=lib).status_code == 422


# ---------------------------------------------------------------- search, dashboards, reports

@pytest.mark.parametrize("mode", ["keyword", "semantic", "hybrid"])
def test_search_modes_return_results(client, mode):
    h = H(client, "meera@kle.edu")
    r = client.get(f"{API}/search?q=machine+learning&mode={mode}", headers=h)
    assert r.status_code == 200, r.text
    assert "results" in r.json() or "items" in r.json()


def test_search_blank_and_gibberish_do_not_crash(client):
    h = H(client, "meera@kle.edu")
    for q in ("", "zzzzqqqq", "'; DROP TABLE books; --", "%", "a" * 300):
        assert client.get(f"{API}/search", params={"q": q}, headers=h).status_code in (200, 422), q
        assert client.get(f"{API}/books", params={"q": q}, headers=h).status_code in (200, 422), q


@pytest.mark.parametrize("email", ["meera@kle.edu", "prof.rao@kle.edu", "librarian@kle.edu", "admin@kle.edu"])
def test_dashboard_for_every_role(client, email):
    r = client.get(f"{API}/dashboard", headers=H(client, email))
    assert r.status_code == 200 and r.json()


def test_reports_shapes(client):
    lib = H(client, "librarian@kle.edu")
    for p in ("overdue", "inventory", "most-borrowed", "circulation"):
        r = client.get(f"{API}/reports/{p}", headers=lib)
        assert r.status_code == 200, (p, r.text)


def test_pagination_and_validation_guards(client):
    lib = H(client, "librarian@kle.edu")
    assert client.get(f"{API}/books?page=0", headers=lib).status_code == 422
    assert client.get(f"{API}/books?page_size=100000", headers=lib).status_code == 422
    assert client.get(f"{API}/books/not-a-uuid", headers=lib).status_code == 422
    assert client.get(f"{API}/books/{uuid.uuid4()}", headers=lib).status_code == 404
    assert client.post(f"{API}/issues", content="{bad json", headers={**lib, "Content-Type": "application/json"}).status_code == 422


def test_renewal_blocked_while_someone_is_waiting(client):
    lib = H(client, "librarian@kle.edu")
    book_id, loan, owner = _fully_issued_book(client, lib)
    owner_h = H(client, owner["email"])
    # no queue yet -> renewal works
    assert client.post(f"{API}/loans/{loan['id']}/renew", headers=owner_h).status_code == 200
    _, waiter = make_user(client)
    assert client.post(f"{API}/reservations", json={"book_id": book_id}, headers=waiter).status_code == 201
    blocked = client.post(f"{API}/loans/{loan['id']}/renew", headers=owner_h)
    assert blocked.status_code == 422 and "waiting" in blocked.text.lower()


@pytest.mark.parametrize("key,bad", [
    ("borrow_limit", {"student": 4}),                       # missing roles
    ("borrow_limit", {"student": "x", "faculty": 1, "librarian": 1, "admin": 1}),
    ("loan_period_days", {"student": 0, "faculty": 30, "librarian": 30, "admin": 30}),
    ("max_renewals", -1),
    ("max_renewals", "two"),
    ("ai_chatbot_enabled", "yes"),
    ("contact_email", "   "),
])
def test_settings_reject_malformed_values(client, key, bad):
    admin = H(client, "admin@kle.edu")
    r = client.put(f"{API}/admin/settings", json={"key": key, "value": bad}, headers=admin)
    assert r.status_code == 422, (key, bad, r.text)


def test_settings_role_map_roundtrip(client):
    admin = H(client, "admin@kle.edu")
    cur = client.get(f"{API}/admin/settings", headers=admin).json()["values"]["loan_period_days"]
    new = {**cur, "student": 21}
    try:
        assert client.put(f"{API}/admin/settings", json={"key": "loan_period_days", "value": new}, headers=admin).status_code == 200
        user, _ = make_user(client)
        lib = H(client, "librarian@kle.edu")
        loan = issue(client, lib, user["id"], avail_books(client, lib, 1)[0]).json()
        days = (datetime.fromisoformat(loan["due_at"]) - datetime.fromisoformat(loan["issued_at"])).days
        assert days in (20, 21)
    finally:
        client.put(f"{API}/admin/settings", json={"key": "loan_period_days", "value": cur}, headers=admin)
