from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import Protocol

from fastapi import Depends, HTTPException, Response, status
from redis.exceptions import RedisError

from applywise.auth import AuthContext, get_current_auth, get_current_user
from applywise.models import User
from applywise.redis_client import get_redis_client

DEFAULT_AI_ACTIONS_PER_HOUR = 30
AI_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
current_user_dependency = Depends(get_current_user)
current_auth_dependency = Depends(get_current_auth)


class RateLimitStore(Protocol):
    def increment(self, key: str, window_seconds: int) -> tuple[int, int]: ...


class RedisRateLimitStore:
    def increment(self, key: str, window_seconds: int) -> tuple[int, int]:
        client = get_redis_client()
        with client.pipeline(transaction=True) as pipeline:
            pipeline.incr(key)
            pipeline.ttl(key)
            count, ttl = pipeline.execute()

        current_count = int(count)
        remaining_ttl = int(ttl)
        if current_count == 1 or remaining_ttl < 0:
            client.expire(key, window_seconds)
            remaining_ttl = window_seconds
        return current_count, remaining_ttl


@dataclass(frozen=True)
class RateLimitResult:
    limit: int
    remaining: int
    reset_seconds: int


def ai_action_limit() -> int:
    raw_value = os.environ.get("AI_ACTIONS_PER_HOUR", str(DEFAULT_AI_ACTIONS_PER_HOUR))
    try:
        value = int(raw_value)
    except ValueError:
        return DEFAULT_AI_ACTIONS_PER_HOUR
    return value if value > 0 else DEFAULT_AI_ACTIONS_PER_HOUR


def consume_ai_action(
    user_id: uuid.UUID,
    *,
    store: RateLimitStore | None = None,
) -> RateLimitResult:
    limit = ai_action_limit()
    rate_limit_store = store or RedisRateLimitStore()
    key = f"applywise:rate-limit:ai:{user_id}"

    try:
        count, ttl = rate_limit_store.increment(key, AI_RATE_LIMIT_WINDOW_SECONDS)
    except RedisError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Usage controls are temporarily unavailable. Try again shortly.",
        ) from exc

    reset_seconds = max(ttl, 1)
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Hourly AI action limit reached. Try again after the quota resets.",
            headers={
                "Retry-After": str(reset_seconds),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_seconds),
            },
        )

    return RateLimitResult(
        limit=limit,
        remaining=max(limit - count, 0),
        reset_seconds=reset_seconds,
    )


def enforce_ai_action_limit(
    response: Response,
    current_user: User = current_user_dependency,
) -> None:
    result = consume_ai_action(current_user.id)
    response.headers["X-RateLimit-Limit"] = str(result.limit)
    response.headers["X-RateLimit-Remaining"] = str(result.remaining)
    response.headers["X-RateLimit-Reset"] = str(result.reset_seconds)


def enforce_ai_action_limit_for_auth(
    response: Response,
    current_auth: AuthContext = current_auth_dependency,
) -> None:
    result = consume_ai_action(current_auth.user.id)
    response.headers["X-RateLimit-Limit"] = str(result.limit)
    response.headers["X-RateLimit-Remaining"] = str(result.remaining)
    response.headers["X-RateLimit-Reset"] = str(result.reset_seconds)


ai_action_limit_dependency = Depends(enforce_ai_action_limit)
ai_action_auth_limit_dependency = Depends(enforce_ai_action_limit_for_auth)
