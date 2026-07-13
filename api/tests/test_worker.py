from __future__ import annotations

import pytest

from applywise.worker import worker_command


def test_worker_command_uses_low_concurrency_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("WORKER_PROCESSES", raising=False)
    monkeypatch.delenv("WORKER_THREADS", raising=False)

    assert worker_command() == [
        "dramatiq",
        "applywise.embedding_tasks:redis_broker",
        "--processes",
        "1",
        "--threads",
        "2",
        "--queues",
        "embeddings",
    ]


def test_worker_command_validates_concurrency(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WORKER_PROCESSES", "0")

    with pytest.raises(RuntimeError, match="WORKER_PROCESSES"):
        worker_command()
