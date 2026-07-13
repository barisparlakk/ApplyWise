from __future__ import annotations

from io import BytesIO
from urllib.error import HTTPError
from urllib.request import Request

import pytest

import applywise.cloudflare_ai as cloudflare_ai
from applywise.cloudflare_ai import CloudflareAIError, CloudflareWorkersAIClient


class FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.payload


def build_client() -> CloudflareWorkersAIClient:
    return CloudflareWorkersAIClient(
        account_id="account-id",
        api_token="api-token",
        llm_model="@cf/meta/test-model",
        embedding_model="@cf/google/test-embedding",
    )


def test_generate_json_returns_structured_response(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_urlopen(request: Request, *, timeout: float) -> FakeResponse:
        assert timeout == 30
        assert request.full_url.endswith("/ai/run/@cf/meta/test-model")
        return FakeResponse(b'{"success":true,"result":{"response":{"skills":["Python"]}}}')

    monkeypatch.setattr(cloudflare_ai, "urlopen", fake_urlopen)

    result = build_client().generate_json(
        system_prompt="Return JSON.",
        user_content="Python role",
        json_schema={"type": "object"},
    )

    assert result == '{"skills": ["Python"]}'


def test_embed_parses_single_and_batched_vectors(monkeypatch: pytest.MonkeyPatch) -> None:
    payloads = iter(
        [
            b'{"success":true,"result":{"data":[0.1,0.2]}}',
            b'{"success":true,"result":{"data":[[0.1,0.2],[0.3,0.4]]}}',
        ]
    )
    monkeypatch.setattr(
        cloudflare_ai,
        "urlopen",
        lambda *_args, **_kwargs: FakeResponse(next(payloads)),
    )
    client = build_client()

    assert client.embed(["one"]) == [[0.1, 0.2]]
    assert client.embed(["one", "two"]) == [[0.1, 0.2], [0.3, 0.4]]


def test_rate_limit_error_is_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    def rate_limited(*_args: object, **_kwargs: object) -> FakeResponse:
        nonlocal calls
        calls += 1
        raise HTTPError(
            "https://example.test",
            429,
            "Too Many Requests",
            hdrs=None,
            fp=BytesIO(b'{"errors":[{"message":"daily quota exceeded"}]}'),
        )

    monkeypatch.setattr(cloudflare_ai, "urlopen", rate_limited)

    with pytest.raises(CloudflareAIError, match="daily quota exceeded"):
        build_client().embed(["test"])

    assert calls == 1
