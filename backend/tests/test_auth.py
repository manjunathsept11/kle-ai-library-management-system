from __future__ import annotations

from tests.conftest import auth_headers


def test_login_success_and_me(client):
    headers = auth_headers(client, "asha@kle.edu")
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "student"
    assert me.json()["email"] == "asha@kle.edu"


def test_login_wrong_password(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "asha@kle.edu", "password": "wrong"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "authentication_failed"


def test_register_then_login(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newstudent@kle.edu",
            "password": "Password123",
            "full_name": "New Student",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "student"
    assert auth_headers(client, "newstudent@kle.edu")


def test_register_rejects_self_assigned_admin(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "sneaky@kle.edu",
            "password": "Password123",
            "full_name": "Sneaky Person",
            "role": "admin",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "student"  # forced back to student


def test_refresh_rotation(client):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "asha@kle.edu", "password": "Password123"},
    ).json()
    resp = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}
    )
    assert resp.status_code == 200
    assert resp.json()["refresh_token"] != login["refresh_token"]
    # Old token is now revoked.
    reuse = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}
    )
    assert reuse.status_code == 401


def test_protected_route_requires_token(client):
    assert client.get("/api/v1/books").status_code == 401
