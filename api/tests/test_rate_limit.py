from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError

from applywise.rate_limit import (
    AI_GLOBAL_RATE_LIMIT_WINDOW_SECONDS,
    AI_RATE_LIMIT_WINDOW_SECONDS,
    consume_ai_action,
)


class CountingStore:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    def increment(self, key: str, window_seconds: int) -> tuple[int, int]:
        assert key.startswith("applywise:rate-limit:ai:")
        assert window_seconds in {
            AI_RATE_LIMIT_WINDOW_SECONDS,
            AI_GLOBAL_RATE_LIMIT_WINDOW_SECONDS,
        }
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key], 1200


class FailingStore:
    def increment(self, _key: str, _window_seconds: int) -> tuple[int, int]:
        raise ConnectionError("redis unavailable")


def test_ai_quota_reports_remaining_and_rejects_excess(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_ACTIONS_PER_HOUR", "2")
    monkeypatch.setenv("AI_GLOBAL_ACTIONS_PER_DAY", "100")
    store = CountingStore()
    user_id = uuid.uuid4()

    first = consume_ai_action(user_id, store=store)
    second = consume_ai_action(user_id, store=store)

    assert first.remaining == 1
    assert first.global_remaining == 99
    assert second.remaining == 0
    with pytest.raises(HTTPException) as exc_info:
        consume_ai_action(user_id, store=store)

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers is not None
    assert exc_info.value.headers["Retry-After"] == "1200"


def test_global_daily_ai_quota_protects_free_capacity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_ACTIONS_PER_HOUR", "10")
    monkeypatch.setenv("AI_GLOBAL_ACTIONS_PER_DAY", "2")
    store = CountingStore()

    consume_ai_action(uuid.uuid4(), store=store)
    consume_ai_action(uuid.uuid4(), store=store)
    with pytest.raises(HTTPException) as exc_info:
        consume_ai_action(uuid.uuid4(), store=store)

    assert exc_info.value.status_code == 429
    assert "daily AI capacity" in str(exc_info.value.detail)
    assert exc_info.value.headers is not None
    assert exc_info.value.headers["X-AI-Daily-Remaining"] == "0"


def test_ai_quota_fails_closed_when_redis_is_unavailable() -> None:
    with pytest.raises(HTTPException) as exc_info:
        consume_ai_action(uuid.uuid4(), store=FailingStore())

    assert exc_info.value.status_code == 503
