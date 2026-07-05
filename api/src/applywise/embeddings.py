from __future__ import annotations

import hashlib
import math

from applywise.models import EMBEDDING_DIMENSIONS


class DeterministicEmbeddingProvider:
    def __init__(self, dimensions: int = EMBEDDING_DIMENSIONS) -> None:
        self.dimensions = dimensions

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
