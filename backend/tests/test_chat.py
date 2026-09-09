from __future__ import annotations

from tests.conftest import auth_headers


def test_chat_policy_question_is_grounded(client):
    h = auth_headers(client, "asha@kle.edu")
    resp = client.post(
        "/api/v1/ai/chat",
        json={"question": "Explain the borrowing and renewal policy"},
        headers=h,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sources"], "expected grounded sources"
    assert any(s["kind"] == "policy" for s in body["sources"])
    assert "disclaimer" in body


def test_chat_loan_question_uses_member_data(client):
    lib = auth_headers(client, "librarian@kle.edu")
    stu = auth_headers(client, "asha@kle.edu")
    member = client.get("/api/v1/auth/me", headers=stu).json()
    book_id = client.get(
        "/api/v1/books?available_only=true", headers=stu
    ).json()["items"][0]["id"]
    client.post(
        "/api/v1/issues",
        json={"member_id": member["id"], "book_id": book_id},
        headers=lib,
    )

    resp = client.post(
        "/api/v1/ai/chat",
        json={"question": "What books do I have on loan right now?"},
        headers=stu,
    )
    assert resp.status_code == 200
    assert any(s["kind"] == "loan" for s in resp.json()["sources"])


def test_chat_does_not_leak_other_members(client):
    # Asha asks about someone else - the assistant only ever sees her own data.
    h = auth_headers(client, "asha@kle.edu")
    resp = client.post(
        "/api/v1/ai/chat",
        json={"question": "What has Vikram Rao borrowed?"},
        headers=h,
    )
    assert resp.status_code == 200
    assert "vikram" not in resp.json()["answer"].lower() or "cannot" in resp.json()[
        "answer"
    ].lower()


def test_chat_session_history(client):
    h = auth_headers(client, "vikram@kle.edu")
    first = client.post(
        "/api/v1/ai/chat",
        json={"question": "What are the library opening hours?"},
        headers=h,
    ).json()
    sid = first["session_id"]
    detail = client.get(f"/api/v1/ai/chat/sessions/{sid}", headers=h)
    assert detail.status_code == 200
    roles = [m["role"] for m in detail.json()["messages"]]
    assert roles[:2] == ["user", "assistant"]


def test_chat_ai_disabled_returns_friendly_error(client, db):
    from app.services import settings_service

    settings_service.set_value(db, "ai_chatbot_enabled", False)
    db.commit()
    try:
        resp = client.post(
            "/api/v1/ai/chat",
            json={"question": "hello"},
            headers=auth_headers(client, "asha@kle.edu"),
        )
        assert resp.status_code == 503
        assert resp.json()["error"]["code"] == "ai_unavailable"
    finally:
        settings_service.set_value(db, "ai_chatbot_enabled", True)
        db.commit()
