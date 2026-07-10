from __future__ import annotations

import pytest

from applywise.database import normalize_database_url


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (
            "postgresql://user:password@database.example/applywise?sslmode=require",
            "postgresql+psycopg://user:password@database.example/applywise?sslmode=require",
        ),
        (
            "postgres://user:password@database.example/applywise",
            "postgresql+psycopg://user:password@database.example/applywise",
        ),
        (
            "postgresql+psycopg://user:password@database.example/applywise",
            "postgresql+psycopg://user:password@database.example/applywise",
        ),
        ("sqlite+pysqlite:///:memory:", "sqlite+pysqlite:///:memory:"),
    ],
)
def test_normalize_database_url(value: str, expected: str) -> None:
    assert normalize_database_url(value) == expected
