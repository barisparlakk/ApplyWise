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

    validate_runtime_environment()
