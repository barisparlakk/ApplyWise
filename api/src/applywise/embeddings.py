from __future__ import annotations

import hashlib
import math
import os
from typing import Protocol

from applywise.cloudflare_ai import CloudflareAIError, CloudflareWorkersAIClient
from applywise.models import EMBEDDING_DIMENSIONS


class EmbeddingProvider(Protocol):
    dimensions: int
    model_name: str

    def embed(self, text: str) -> list[float]: ...

    def embed_many(self, texts: list[str]) -> list[list[float]]: ...


class DeterministicEmbeddingProvider:
    def __init__(self, dimensions: int = EMBEDDING_DIMENSIONS) -> None:
        self.dimensions = dimensions
        self.model_name = f"deterministic-sha256-v1-{dimensions}"

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = [token.strip(".,:;()[]{}").lower() for token in text.split()]
        for token in tokens:
            if not token:
                continue
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            direction = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += direction

        magnitude = math.sqrt(sum(item * item for item in vector))
        if magnitude == 0:
            return vector
        return [item / magnitude for item in vector]

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(text) for text in texts]


class CloudflareEmbeddingProvider:
    def __init__(
        self,
        client: CloudflareWorkersAIClient,
        *,
        dimensions: int = EMBEDDING_DIMENSIONS,
    ) -> None:
        self.client = client
        self.dimensions = dimensions
        self.model_name = f"cloudflare:{client.embedding_model}:padded-{dimensions}"

    def embed(self, text: str) -> list[float]:
        vectors = self.embed_many([text])
        if not vectors:
            raise CloudflareAIError("Workers AI returned no embedding.")
        return vectors[0]

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [self._fit_dimensions(vector) for vector in self.client.embed(texts)]

    def _fit_dimensions(self, vector: list[float]) -> list[float]:
        if len(vector) > self.dimensions:
            raise CloudflareAIError(
                f"Embedding has {len(vector)} dimensions; expected at most {self.dimensions}."
            )
        if len(vector) == self.dimensions:
            return vector
        return [*vector, *([0.0] * (self.dimensions - len(vector)))]


def get_embedding_provider() -> EmbeddingProvider:
    provider = os.environ.get("EMBEDDING_PROVIDER", "deterministic").strip().lower()
    if provider in {"", "local", "deterministic", "heuristic"}:
        return DeterministicEmbeddingProvider()
    if provider == "cloudflare":
        return CloudflareEmbeddingProvider(CloudflareWorkersAIClient.from_environment())
    raise RuntimeError(f"Unsupported embedding provider: {provider}.")


def safe_embed(provider: EmbeddingProvider, text: str) -> list[float] | None:
    try:
        return provider.embed(text)
    except CloudflareAIError:
        return None


def safe_embed_many(
    provider: EmbeddingProvider,
    texts: list[str],
) -> list[list[float] | None]:
    if not texts:
        return []
    try:
        return list(provider.embed_many(texts))
    except CloudflareAIError:
        return [None] * len(texts)


def chunk_text(text: str, *, max_chars: int = 1200, overlap: int = 150) -> list[str]:
    normalized = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if not normalized:
        return []

    chunks: list[str] = []
    cursor = 0
    while cursor < len(normalized):
        end = min(cursor + max_chars, len(normalized))
        if end < len(normalized):
            next_break = normalized.rfind("\n", cursor, end)
            if next_break > cursor + 300:
                end = next_break

        chunk = normalized[cursor:end].strip()
        if chunk:
            chunks.append(chunk)

        if end == len(normalized):
            break
        cursor = max(end - overlap, cursor + 1)

    return chunks
