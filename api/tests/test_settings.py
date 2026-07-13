from __future__ import annotations

import pytest

from applywise.auth import DEFAULT_AUTH_JWT_SECRET
from applywise.database import DEFAULT_DATABASE_URL
from applywise.settings import validate_runtime_environment


def test_development_allows_local_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("AUTH_JWT_SECRET", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    validate_runtime_environment()


def test_production_rejects_default_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    monkeypatch.setenv("AUTH_JWT_SECRET", DEFAULT_AUTH_JWT_SECRET)
    monkeypatch.setenv("AUTH_JWT_AUDIENCE", "applywise-api")
    monkeypatch.setenv("AUTH_JWT_ISSUER", "applywise-web")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.applywise.example")
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("ALLOWED_HOSTS", "api,localhost,127.0.0.1")

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        validate_runtime_environment()


def test_production_accepts_complete_secure_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://deploy_user:secure-production-password@postgres:5432/applywise",
    )
    monkeypatch.setenv("AUTH_JWT_SECRET", "a" * 48)
    monkeypatch.setenv("AUTH_JWT_AUDIENCE", "applywise-api")
    monkeypatch.setenv("AUTH_JWT_ISSUER", "applywise-web")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.applywise.example")
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("ALLOWED_HOSTS", "api,localhost,127.0.0.1")

    validate_runtime_environment()


def test_production_can_require_an_external_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://deploy_user:secure-production-password@postgres:5432/applywise",
    )
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("AUTH_JWT_SECRET", "a" * 48)
    monkeypatch.setenv("AUTH_JWT_AUDIENCE", "applywise-api")
    monkeypatch.setenv("AUTH_JWT_ISSUER", "applywise-web")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.applywise.example")
    monkeypatch.setenv("ALLOWED_HOSTS", "api,localhost,127.0.0.1")
    monkeypatch.setenv("REQUIRE_EXTERNAL_LLM", "true")
    monkeypatch.setenv("LLM_PROVIDER", "local")

    with pytest.raises(RuntimeError, match="external LLM"):
        validate_runtime_environment()

    monkeypatch.setenv("LLM_PROVIDER", "openai-compatible")
    monkeypatch.setenv("LLM_API_URL", "https://llm.example.test/v1/chat/completions")
    monkeypatch.setenv("LLM_API_KEY", "test-provider-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    validate_runtime_environment()


def test_production_accepts_cloudflare_ai_for_llm_and_embeddings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://deploy_user:secure-production-password@postgres:5432/applywise",
    )
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("AUTH_JWT_SECRET", "a" * 48)
    monkeypatch.setenv("AUTH_JWT_AUDIENCE", "applywise-api")
    monkeypatch.setenv("AUTH_JWT_ISSUER", "applywise-web")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.applywise.example")
    monkeypatch.setenv("ALLOWED_HOSTS", "api,localhost,127.0.0.1")
    monkeypatch.setenv("REQUIRE_EXTERNAL_LLM", "true")
    monkeypatch.setenv("REQUIRE_EXTERNAL_EMBEDDINGS", "true")
    monkeypatch.setenv("LLM_PROVIDER", "cloudflare")
    monkeypatch.setenv("EMBEDDING_PROVIDER", "cloudflare")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "account-id")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "real-token")

    validate_runtime_environment()


def test_production_rejects_incomplete_cloudflare_ai_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://deploy_user:secure-production-password@postgres:5432/applywise",
    )
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")
    monkeypatch.setenv("AUTH_JWT_SECRET", "a" * 48)
    monkeypatch.setenv("AUTH_JWT_AUDIENCE", "applywise-api")
    monkeypatch.setenv("AUTH_JWT_ISSUER", "applywise-web")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.applywise.example")
    monkeypatch.setenv("ALLOWED_HOSTS", "api,localhost,127.0.0.1")
    monkeypatch.setenv("LLM_PROVIDER", "cloudflare")
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)

    with pytest.raises(RuntimeError, match="Cloudflare Workers AI"):
        validate_runtime_environment()
