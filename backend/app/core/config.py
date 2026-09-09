"""Application configuration.

All secrets and environment-specific values are read from environment variables
(or a local .env file during development). Nothing sensitive is hard-coded.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- General ---------------------------------------------------------
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    PROJECT_NAME: str = "KLE Institute AI Library Management System"
    API_V1_PREFIX: str = "/api/v1"
    # Institution label shown in the UI. Real KLE branding/policies stay
    # admin-configurable; this is only a display default.
    INSTITUTION_NAME: str = "KLE Institute"

    # --- Database -------------------------------------------------------
    # Local dev uses SQLite (zero install). Production points this at
    # PostgreSQL, e.g. postgresql+psycopg://user:pass@host:5432/library
    DATABASE_URL: str = Field(default="sqlite:///./var/library.db")

    # --- Auth ----------------------------------------------------------
    JWT_SECRET: str = Field(default="dev-only-insecure-change-me", min_length=8)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    # Failed logins allowed before a temporary account lock.
    MAX_FAILED_LOGINS: int = 5
    ACCOUNT_LOCK_MINUTES: int = 15

    # --- CORS --------------------------------------------------------
    CORS_ORIGINS: list[str] = [
        "http://localhost:5180",
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v: object) -> object:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # --- AI providers -------------------------------------------------
    # "openai" | "anthropic" | "local" | "mock". "mock" keeps the whole
    # system working with zero external calls (deterministic fallback).
    AI_ENABLED: bool = True
    LLM_PROVIDER: Literal["openai", "anthropic", "local", "mock"] = "mock"
    EMBEDDING_PROVIDER: Literal["openai", "local", "mock"] = "mock"

    LLM_API_KEY: str | None = None
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_BASE_URL: str | None = None
    LLM_TIMEOUT_SECONDS: float = 30.0
    # Per-user hourly cap on chatbot calls (cost + abuse control).
    CHAT_RATE_LIMIT_PER_HOUR: int = 60

    EMBEDDING_API_KEY: str | None = None
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536
    # Local sentence-transformers model used when EMBEDDING_PROVIDER == "local".
    LOCAL_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # --- Email (notifications) --------------------------------------
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "library@kle.edu"
    EMAIL_ENABLED: bool = False

    # --- Files ------------------------------------------------------
    STORAGE_DIR: str = "./var/storage"
    MAX_UPLOAD_MB: int = 20

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_sqlite(self) -> bool:
        return str(self.DATABASE_URL).startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
