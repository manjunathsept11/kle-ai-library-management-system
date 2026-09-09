from __future__ import annotations

from tests.conftest import auth_headers


def test_keyword_search(client):
    h = auth_headers(client, "asha@kle.edu")
    resp = client.post(
        "/api/v1/search", json={"query": "java", "mode": "keyword"}, headers=h
    )
    assert resp.status_code == 200
    titles = [r["book"]["title"].lower() for r in resp.json()["results"]]
    assert any("java" in t for t in titles)


def test_semantic_search_returns_results_and_reasons(client):
    h = auth_headers(client, "asha@kle.edu")
    resp = client.post(
        "/api/v1/search",
        json={"query": "learning to program in python for beginners", "mode": "semantic"},
        headers=h,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ai_used"] is True
    assert body["count"] > 0
    assert all(r["reason"] for r in body["results"])


def test_hybrid_search_available_only_filter(client):
    h = auth_headers(client, "asha@kle.edu")
    resp = client.post(
        "/api/v1/search",
        json={"query": "algorithms", "mode": "hybrid", "available_only": True},
        headers=h,
    )
    assert resp.status_code == 200
    for r in resp.json()["results"]:
        assert r["book"]["available_copies"] >= 1


def test_reindex_requires_staff(client):
    assert (
        client.post(
            "/api/v1/search/reindex",
            headers=auth_headers(client, "asha@kle.edu"),
        ).status_code
        == 403
    )
    ok = client.post(
        "/api/v1/search/reindex",
        headers=auth_headers(client, "librarian@kle.edu"),
    )
    assert ok.status_code == 200
