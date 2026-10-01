"""Shared pytest fixtures for the ApplyWise test suite.

Lightweight, deterministic fixtures only — no real database or network calls.
Tests that require PostgreSQL with pgvector must be marked with the
``postgres`` marker and provide their own engine via ``TEST_DATABASE_URL``.
"""
from __future__ import annotations

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.auth import create_backend_jwt
from applywise.models import Base, Profile, User


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


@pytest.fixture()
def engine():
    """In-memory SQLite engine with the full ApplyWise schema applied."""
    _engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(_engine)
    yield _engine
    _engine.dispose()


@pytest.fixture()
def session(engine):
    """Database session bound to the in-memory engine, rolled back after each test."""
    with Session(engine) as _session:
        yield _session


# ---------------------------------------------------------------------------
# Users & authentication
# ---------------------------------------------------------------------------


@pytest.fixture()
def demo_user(session) -> User:
    """Persisted demo user with a complete profile."""
    user = User(
        email="demo@applywise.dev",
        full_name="Demo Student",
        auth_subject="email:demo@applywise.dev",
    )
    session.add(user)
    session.flush()

    profile = Profile(
        user_id=user.id,
        headline="Computer Engineering Student",
        location="Istanbul",
        education_level="BS Computer Engineering",
        skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
        target_roles=["AI/ML Intern", "Backend Intern"],
        experience_level="Student projects",
        languages=[{"name": "English", "level": "B2"}, {"name": "Turkish", "level": "Native"}],
        preferred_location="Remote",
        internship_type="Summer internship",
    )
    session.add(profile)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture()
def demo_token(demo_user) -> str:
    """Valid short-lived JWT for the demo user."""
    return create_backend_jwt(
        subject=f"email:{demo_user.email}",
        email=demo_user.email,
        name=demo_user.full_name or "",
    )


@pytest.fixture()
def demo_credentials(demo_token) -> HTTPAuthorizationCredentials:
    """HTTPAuthorizationCredentials wrapping the demo JWT."""
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=demo_token)
