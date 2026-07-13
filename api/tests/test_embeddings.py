from __future__ import annotations

import pytest

from applywise.cloudflare_ai import CloudflareAIError, CloudflareWorkersAIClient
from applywise.embeddings import (
    CloudflareEmbeddingProvider,
    DeterministicEmbeddingProvider,
    get_embedding_provider,
    safe_embed_many,
)


class FakeCloudflareClient(CloudflareWorkersAIClient):
    def __init__(self) -> None:
        super().__init__(
            account_id="account-id",
            api_token="api-token",
            embedding_model="@cf/google/test-embedding",
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [[float(index + 1), 2.0] for index, _text in enumerate(texts)]


class FailingEmbeddingProvider(DeterministicEmbeddingProvider):
    def embed_many(self, texts: list[str]) -> list[list[float]]:
        raise CloudflareAIError(f"quota unavailable for {len(texts)} inputs")


def test_cloudflare_embeddings_are_padded_to_pgvector_dimensions() -> None:
    provider = CloudflareEmbeddingProvider(FakeCloudflareClient(), dimensions=4)

    vectors = provider.embed_many(["first", "second"])

    assert vectors == [[1.0, 2.0, 0.0, 0.0], [2.0, 2.0, 0.0, 0.0]]
    assert provider.model_name == "cloudflare:@cf/google/test-embedding:padded-4"


def test_cloudflare_provider_loads_credentials_from_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EMBEDDING_PROVIDER", "cloudflare")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "account-id")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "api-token")

    provider = get_embedding_provider()

    assert provider.model_name.startswith("cloudflare:")


def test_safe_batch_embedding_degrades_to_missing_vectors() -> None:
    provider = FailingEmbeddingProvider(dimensions=4)

    assert safe_embed_many(provider, ["one", "two"]) == [None, None]
