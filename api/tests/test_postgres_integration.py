from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from applywise.database import normalize_database_url
from applywise.fit_score import FIT_SCORE_WEIGHTS
from applywise.models import FitAnalysis, Profile, Project, User
from applywise.routes.jobs import AnalyzeJobPayload, analyze_job

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "").strip()

pytestmark = [
    pytest.mark.postgres,
    pytest.mark.skipif(
        not TEST_DATABASE_URL,
        reason="TEST_DATABASE_URL is required for PostgreSQL integration tests.",
    ),
]

EXPECTED_VECTOR_INDEXES = {
    "ix_github_repository_chunks_embedding_hnsw",
    "ix_job_posts_embedding_hnsw",
    "ix_resume_chunks_embedding_hnsw",
    "ix_resumes_embedding_hnsw",
}

SAMPLE_JOB = """
Company: Vector Labs
Location: Remote
Position: Backend Intern

Responsibilities
- Build Python and FastAPI services backed by PostgreSQL
- Write tests and explain technical tradeoffs

Requirements
- Python
- SQL
- FastAPI
- PostgreSQL
- English communication

Preferred
- Docker
- CI/CD
"""


def test_migrations_pgvector_job_analysis_and_weighted_fit() -> None:
    engine = create_engine(normalize_database_url(TEST_DATABASE_URL), pool_pre_ping=True)

    with engine.connect() as connection:
        outer_transaction = connection.begin()
        session = Session(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == (
                "20260713_0008"
            )
            assert connection.scalar(
                text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
            ) == "vector"
            indexes = set(
                connection.scalars(
                    text(
                        "SELECT indexname FROM pg_indexes "
                        "WHERE schemaname = current_schema() AND indexname LIKE '%_embedding_hnsw'"
                    )
                )
            )
            assert indexes == EXPECTED_VECTOR_INDEXES

            user = User(
                email="postgres-integration@example.com",
                full_name="PostgreSQL Integration",
                auth_subject="test:postgres-integration",
            )
            session.add(user)
            session.flush()
            session.add(
                Profile(
                    user_id=user.id,
                    education_level="BS Computer Engineering",
                    skills=["Python", "SQL", "FastAPI", "PostgreSQL"],
                    target_roles=["Backend Intern"],
                    languages=[{"name": "English", "level": "B2"}],
                    experience_level="Student projects",
                    github_url="https://github.com/applywise-demo",
                )
            )
            session.add(
                Project(
                    user_id=user.id,
                    name="Application tracker API",
                    description="FastAPI service backed by PostgreSQL with tests.",
                    skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
                )
            )
            session.flush()
            session.refresh(user)

            response = analyze_job(
                AnalyzeJobPayload(
                    content=SAMPLE_JOB,
                    source_url="https://example.com/backend-intern",
                ),
                current_user=user,
                session=session,
                _rate_limit=None,
            )

            assert response.fit_analysis is not None
            components = response.fit_analysis.components.model_dump()
            expected_total = round(
                sum(components[name] * weight for name, weight in FIT_SCORE_WEIGHTS.items()),
                2,
            )
            assert response.fit_analysis.total_score == expected_total
            assert all(0 <= value <= 100 for value in components.values())

            stored_fit = session.get(FitAnalysis, response.fit_analysis.id)
            assert stored_fit is not None
            assert stored_fit.total_score == expected_total
            assert stored_fit.breakdown["weights"] == FIT_SCORE_WEIGHTS

            distance = connection.scalar(
                text(
                    "SELECT embedding <=> embedding FROM job_posts "
                    "WHERE id = CAST(:job_id AS uuid)"
                ),
                {"job_id": str(response.id)},
            )
            assert distance is not None
            assert float(distance) == pytest.approx(0.0, abs=1e-7)
        finally:
            session.close()
            if outer_transaction.is_active:
                outer_transaction.rollback()

    engine.dispose()
