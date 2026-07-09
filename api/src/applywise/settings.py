from __future__ import annotations

import os

from applywise.auth import DEFAULT_AUTH_JWT_SECRET
from applywise.database import DEFAULT_DATABASE_URL


def is_production() -> bool:
    return os.environ.get("APP_ENV", "development").lower() == "production"


def validate_runtime_environment() -> None:
    if not is_production():
        return

    required = ("DATABASE_URL", "AUTH_JWT_SECRET", "AUTH_JWT_AUDIENCE", "AUTH_JWT_ISSUER")
    missing = [name for name in required if not os.environ.get(name, "").strip()]
    if missing:
        raise RuntimeError(
            f"Missing required production environment variables: {', '.join(missing)}"
        )

    database_url = os.environ["DATABASE_URL"]
    if database_url == DEFAULT_DATABASE_URL or "applywise:applywise@" in database_url:
        raise RuntimeError("DATABASE_URL must use non-default production credentials.")

    jwt_secret = os.environ["AUTH_JWT_SECRET"]
    if jwt_secret == DEFAULT_AUTH_JWT_SECRET or len(jwt_secret) < 32:
        raise RuntimeError(
            "AUTH_JWT_SECRET must be a non-default value with at least 32 characters."
        )

    origins = [
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    if not origins:
        raise RuntimeError("CORS_ORIGINS must list the public application origin.")
    if any(not origin.startswith("https://") for origin in origins):
        raise RuntimeError("CORS_ORIGINS must use HTTPS origins in production.")
