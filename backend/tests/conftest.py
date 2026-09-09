"""Shared pytest fixtures.

Each test run gets a fresh SQLite file, the full schema created from ORM
metadata, and a small set of seed rows. AI providers are forced to "mock" so
tests never make network calls.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

os.environ["ENVIRONMENT"] = "test"
os.environ["JWT_SECRET"] = "test-secret-value-1234567890"
os.environ["AI_ENABLED"] = "true"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["EMBEDDING_PROVIDER"] = "mock"

_tmp = Path(tempfile.gettempdir()) / "kle_library_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.as_posix()}"


@pytest.fixture(scope="session", autouse=True)
def _db_setup() -> Iterator[None]:
    if _tmp.exists():
        _tmp.unlink()
    from app.db.base import Base
    from app.db.session import engine
    from app.models import load_all

    load_all()
    Base.metadata.create_all(engine)
    yield
    engine.dispose()
    if _tmp.exists():
        _tmp.unlink()


@pytest.fixture(scope="session")
def seeded() -> None:
    """Populate demo data once for the whole session."""
    from app.db.session import SessionLocal
    from scripts.seed import _seed

    with SessionLocal() as db:
        _seed(db)


@pytest.fixture
def client(seeded):
    from app.main import create_app
    from fastapi.testclient import TestClient

    return TestClient(create_app())


@pytest.fixture
def db():
    from app.db.session import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def auth_headers(client, email: str, password: str = "Password123") -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
