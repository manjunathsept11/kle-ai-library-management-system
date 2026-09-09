"""LLM providers behind a single interface, used only by the RAG chatbot.

Providers: mock (deterministic, offline), openai, anthropic.

The chatbot never lets the model call tools or execute SQL directly. It passes
already-retrieved, access-checked context and asks for a grounded answer.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.errors import AIServiceError


@dataclass
class LLMMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResult:
    text: str
    model: str
    provider: str


class LLMProvider(Protocol):
    name: str

    def complete(self, messages: list[LLMMessage], *, max_tokens: int = 600) -> LLMResult:
        ...


class MockLLMProvider:
    """Deterministic, grounded-only responder for offline dev and tests.

    It summarises the retrieved context passed in the final user message rather
    than inventing anything, which keeps behaviour honest without an API.
    """

    name = "mock"

    def complete(
        self, messages: list[LLMMessage], *, max_tokens: int = 600
    ) -> LLMResult:
        context_blocks = [m.content for m in messages if m.role == "system"]
        context = "\n".join(context_blocks)
        if "CONTEXT:" in context:
            snippet = context.split("CONTEXT:", 1)[1].strip()
            snippet = snippet[:800].rsplit(" ", 1)[0] if len(snippet) > 800 else snippet
            body = (
                "Based on the library information available:\n\n"
                f"{snippet}\n\n"
                "If this does not fully answer your question, please ask library "
                "staff to confirm."
            )
        else:
            body = (
                "I can only answer from the library's own information and I could "
                "not find anything relevant to that. Please rephrase or contact "
                "library staff."
            )
        return LLMResult(text=body, model="mock-llm", provider=self.name)


class _HTTPChatProvider:
    name = "http"
    _url = ""
    _model = ""

    def _headers(self) -> dict[str, str]:
        return {}

    def _payload(self, messages: list[LLMMessage], max_tokens: int) -> dict:
        raise NotImplementedError

    def _parse(self, data: dict) -> str:
        raise NotImplementedError

    def complete(
        self, messages: list[LLMMessage], *, max_tokens: int = 600
    ) -> LLMResult:
        try:
            resp = httpx.post(
                self._url,
                headers=self._headers(),
                json=self._payload(messages, max_tokens),
                timeout=settings.LLM_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AIServiceError("The chatbot provider request failed") from exc
        return LLMResult(
            text=self._parse(resp.json()).strip(),
            model=self._model,
            provider=self.name,
        )


class OpenAIChatProvider(_HTTPChatProvider):
    name = "openai"

    def __init__(self) -> None:
        if not settings.LLM_API_KEY:
            raise AIServiceError("LLM_API_KEY is not configured")
        base = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        self._url = f"{base}/chat/completions"
        self._model = settings.LLM_MODEL

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {settings.LLM_API_KEY}"}

    def _payload(self, messages: list[LLMMessage], max_tokens: int) -> dict:
        return {
            "model": self._model,
            "max_tokens": max_tokens,
            "temperature": 0.2,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }

    def _parse(self, data: dict) -> str:
        return data["choices"][0]["message"]["content"]


class AnthropicChatProvider(_HTTPChatProvider):
    name = "anthropic"

    def __init__(self) -> None:
        if not settings.LLM_API_KEY:
            raise AIServiceError("LLM_API_KEY is not configured")
        base = (settings.LLM_BASE_URL or "https://api.anthropic.com/v1").rstrip("/")
        self._url = f"{base}/messages"
        self._model = settings.LLM_MODEL

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": settings.LLM_API_KEY or "",
            "anthropic-version": "2023-06-01",
        }

    def _payload(self, messages: list[LLMMessage], max_tokens: int) -> dict:
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        turns = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]
        return {
            "model": self._model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": turns,
        }

    def _parse(self, data: dict) -> str:
        return "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )


@lru_cache
def get_llm_provider() -> LLMProvider:
    provider = settings.LLM_PROVIDER
    if provider == "openai":
        return OpenAIChatProvider()
    if provider == "anthropic":
        return AnthropicChatProvider()
    return MockLLMProvider()
