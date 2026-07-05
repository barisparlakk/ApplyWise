from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DEFAULT_DATABASE_URL = "postgresql+psycopg://applywise:applywise@localhost:5432/applywise"


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


engine = create_engine(get_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
