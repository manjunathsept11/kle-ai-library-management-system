"""Embedding providers behind a single interface.

Providers:
  * mock  - deterministic hash-based vectors, zero dependencies, offline.
  * local - sentence-transformers (optional install).
  * openai - OpenAI-compatible embeddings API.

The rest of the app depends only on ``get_embedding_provider()`` and the
``EmbeddingProvider`` protocol, so swapping providers never touches callers.
"""

from __future__ import annotations

import hashlib
import math
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.errors import AIServiceError


class EmbeddingProvider(Protocol):
    name: str
    dim: int

    def embed(self, texts: list[str]) -> list[list[float]]: ...


def _normalise(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


class MockEmbeddingProvider:
    """Deterministic pseudo-embeddings from token hashes.

    Not semantically meaningful the way a real model is, but stable and good
    enough to exercise the full search pipeline offline: identical text yields
    identical vectors and shared vocabulary yields higher cosine similarity.
    """

    name = "mock"

    def __init__(self, dim: int = 256) -> None:
        self.dim = dim

    def _hash_token(self, token: str) -> int:
        return int.from_bytes(
            hashlib.sha1(token.encode("utf-8")).digest()[:4], "big"
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for text in texts:
            vec = [0.0] * self.dim
            tokens = [t for t in text.lower().split() if t]
            for tok in tokens:
                h = self._hash_token(tok)
                vec[h % self.dim] += 1.0
                vec[(h // self.dim) % self.dim] += 0.5
            out.append(_normalise(vec))
        return out


class LocalEmbeddingProvider:
    name = "local"

    def __init__(self, model_name: str) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:  # pragma: no cover - optional dep
            raise AIServiceError(
                "Local embeddings need 'sentence-transformers'. "
                "Install it or set EMBEDDING_PROVIDER=mock."
            ) from exc
        self._model = SentenceTransformer(model_name)
        self.dim = int(self._model.get_sentence_embedding_dimension())

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, normalize_embeddings=True)
        return [list(map(float, v)) for v in vectors]


class OpenAIEmbeddingProvider:
    name = "openai"

    def __init__(self) -> None:
        if not settings.EMBEDDING_API_KEY:
            raise AIServiceError("EMBEDDING_API_KEY is not configured")
        self.dim = settings.EMBEDDING_DIM
        self._model = settings.EMBEDDING_MODEL
        self._base = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")

    def embed(self, texts: list[str]) -> list[list[float]]:
        try:
            resp = httpx.post(
                f"{self._base}/embeddings",
                headers={"Authorization": f"Bearer {settings.EMBEDDING_API_KEY}"},
                json={"model": self._model, "input": texts},
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AIServiceError("Embedding provider request failed") from exc
        data = sorted(resp.json()["data"], key=lambda d: d["index"])
        return [_normalise(d["embedding"]) for d in data]


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    provider = settings.EMBEDDING_PROVIDER
    if provider == "local":
        return LocalEmbeddingProvider(settings.LOCAL_EMBEDDING_MODEL)
    if provider == "openai":
        return OpenAIEmbeddingProvider()
    return MockEmbeddingProvider()
