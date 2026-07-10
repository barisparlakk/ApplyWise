from __future__ import annotations

import os

from applywise.auth import DEFAULT_AUTH_JWT_SECRET
from applywise.database import DEFAULT_DATABASE_URL

DEFAULT_MAX_REQUEST_BODY_BYTES = 16 * 1024 * 1024


def is_production() -> bool:
    return os.environ.get("APP_ENV", "development").lower() == "production"


def csv_environment_values(name: str, default: str = "") -> list[str]:
    return [value.strip() for value in os.environ.get(name, default).split(",") if value.strip()]


def allowed_hosts() -> list[str]:
    return csv_environment_values("ALLOWED_HOSTS", "localhost,127.0.0.1,api,testserver")


def max_request_body_bytes() -> int:
    return positive_integer_environment(
        "MAX_REQUEST_BODY_BYTES",
        DEFAULT_MAX_REQUEST_BODY_BYTES,
    )


def positive_integer_environment(name: str, default: int) -> int:
    raw_value = os.environ.get(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a positive integer.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer.")
    return value


def boolean_environment(name: str, default: bool = False) -> bool:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    normalized = raw_value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} must be true or false.")


def validate_runtime_environment() -> None:
    if not is_production():
        return

    required = (
        "DATABASE_URL",
        "REDIS_URL",
        "AUTH_JWT_SECRET",
        "AUTH_JWT_AUDIENCE",
        "AUTH_JWT_ISSUER",
        "ALLOWED_HOSTS",
    )
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

    origins = csv_environment_values("CORS_ORIGINS")
    if not origins:
        raise RuntimeError("CORS_ORIGINS must list the public application origin.")
    if "*" in origins or any(not origin.startswith("https://") for origin in origins):
        raise RuntimeError("CORS_ORIGINS must use HTTPS origins in production.")

    hosts = allowed_hosts()
    if not hosts or "*" in hosts:
        raise RuntimeError("ALLOWED_HOSTS must list explicit internal hostnames.")

    positive_integer_environment("MAX_REQUEST_BODY_BYTES", DEFAULT_MAX_REQUEST_BODY_BYTES)
    positive_integer_environment("AI_ACTIONS_PER_HOUR", 30)

    llm_provider = os.environ.get("LLM_PROVIDER", "local").strip().lower()
    if boolean_environment("REQUIRE_EXTERNAL_LLM") and llm_provider in {
        "",
        "local",
        "heuristic",
    }:
        raise RuntimeError("A configured external LLM provider is required for production.")
    if llm_provider not in {"", "local", "heuristic"}:
        llm_required = ("LLM_API_URL", "LLM_API_KEY", "LLM_MODEL")
        llm_missing = [name for name in llm_required if not os.environ.get(name, "").strip()]
        if llm_missing:
            raise RuntimeError(
                "Missing production LLM configuration: " + ", ".join(llm_missing)
            )
        if not os.environ["LLM_API_URL"].startswith("https://"):
            raise RuntimeError("LLM_API_URL must use HTTPS in production.")
        if os.environ["LLM_API_KEY"].startswith("replace-"):
            raise RuntimeError("LLM_API_KEY must be a real provider credential.")
