from __future__ import annotations

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.models import Base, FitAnalysis, JobPost, LearningRoadmap, User
from applywise.routes.jobs import AnalyzeJobPayload, analyze_job, read_job

SAMPLE_JOB = """
Company: ApplyWise Labs
Location: Istanbul / Remote
Position: Backend Intern

Responsibilities
- Build FastAPI endpoints for internship intelligence workflows
- Implement PostgreSQL queries and API integrations
- Document technical tradeoffs for stakeholders

Requirements
- Python
- SQL
- FastAPI
- PostgreSQL
- Git
- English communication

Preferred
- Docker
- CI/CD
"""


def test_analyze_job_route_persists_structured_analysis_and_embedding() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="jobs@example.com", full_name="Jobs User")
        session.add(user)
        session.commit()
        session.refresh(user)

        response = analyze_job(
            AnalyzeJobPayload(content=SAMPLE_JOB, source_url="https://example.com/job"),
            current_user=user,
            session=session,
        )
        fetched = read_job(response.id, current_user=user, session=session)
        job_count = session.scalar(select(func.count()).select_from(JobPost))
        fit_count = session.scalar(select(func.count()).select_from(FitAnalysis))
        roadmap_count = session.scalar(select(func.count()).select_from(LearningRoadmap))
        saved_job = session.get(JobPost, response.id)

    assert response.company_name == "ApplyWise Labs"
    assert response.location == "Istanbul / Remote"
    assert response.title == "Backend Intern"
    assert "Python" in response.required_skills
    assert "Docker" in response.nice_to_have_skills
    assert fetched.analysis.role_title == "Backend Intern"
    assert fetched.fit_analysis is not None
    assert fetched.fit_analysis.total_score >= 0
    assert fetched.roadmap is not None
    assert len(fetched.roadmap.plan) == 3
    assert fetched.analysis.communication_expectations
    assert saved_job is not None
    assert saved_job.embedding is not None
    assert len(saved_job.embedding) == 1536
    assert job_count == 1
    assert fit_count == 1
    assert roadmap_count == 1
