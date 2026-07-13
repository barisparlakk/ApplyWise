from __future__ import annotations

import json

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.company_profile import generate_and_store_company_profile
from applywise.models import Base, CompanyProfile, JobPost, Profile, Project, User
from applywise.routes.company_profiles import generate_company_profile, read_company_profile


class RetryCompanyProfileProvider:
    def __init__(self) -> None:
        self.calls = 0

    def generate_company_profile_json(self, _context: dict[str, object]) -> str:
        self.calls += 1
        if self.calls == 1:
            return "not-json"
        return json.dumps(
            {
                "what_company_does": (
                    "The supplied posting describes backend services for an internship platform."
                ),
                "likely_interview_angles": [
                    "FastAPI design tradeoffs",
                    "PostgreSQL schema decisions",
                ],
                "projects_to_emphasize": [
                    {
                        "name": "Application Tracker API",
                        "reason": "It uses the role's required backend stack.",
                        "talking_points": ["Explain API ownership", "Show test evidence"],
                    },
                    {
                        "name": "Invented Project",
                        "reason": "This must be removed.",
                        "talking_points": ["Invented evidence"],
                    },
                ],
                "smart_questions": [
                    "How is intern success measured?",
                    "Which service would the intern touch first?",
                    "How does the team review technical decisions?",
                ],
            }
        )


def test_company_profile_is_grounded_retried_stored_and_read() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    provider = RetryCompanyProfileProvider()

    with Session(engine) as session:
        user = User(email="company@example.com", full_name="Company User")
        session.add(user)
        session.flush()
        session.add(
            Profile(
                user_id=user.id,
                education_level="BS Computer Engineering",
                skills=["Python", "FastAPI", "PostgreSQL"],
                target_roles=["Backend Intern"],
            )
        )
        session.add(
            Project(
                user_id=user.id,
                name="Application Tracker API",
                description="A tested FastAPI service backed by PostgreSQL.",
                skills=["Python", "FastAPI", "PostgreSQL"],
            )
        )
        job_post = JobPost(
            user_id=user.id,
            company_name="ApplyWise Labs",
            title="Backend Intern",
            description="Build FastAPI services and PostgreSQL workflows.",
            required_skills=["Python", "FastAPI", "PostgreSQL"],
            nice_to_have_skills=["Docker"],
            responsibilities=["Build backend APIs"],
            seniority_level="Internship",
            domain="Backend",
            hidden_expectations=["Explain tradeoffs"],
            english_requirement="Working proficiency",
            technical_difficulty="Medium",
            business_expectations=["Connect APIs to product outcomes"],
            communication_expectations=["Document decisions"],
            analysis_data={},
        )
        session.add(job_post)
        session.commit()
        session.refresh(user)
        session.refresh(job_post)

        stored = generate_and_store_company_profile(
            session,
            user=user,
            job_post=job_post,
            provider=provider,
        )
        session.commit()
        response = read_company_profile(
            job_post.id,
            current_user=user,
            session=session,
        )
        regenerated = generate_company_profile(
            job_post.id,
            current_user=user,
            session=session,
            _rate_limit=None,
        )
        profile_count = session.scalar(select(func.count()).select_from(CompanyProfile))

    assert provider.calls == 2
    assert stored.projects_to_emphasize[0]["name"] == "Application Tracker API"
    assert len(stored.projects_to_emphasize) == 1
    assert response is not None
    assert response.evidence_basis == "job_post_and_candidate_evidence"
    assert response.smart_questions
    assert regenerated.id == stored.id
    assert profile_count == 1
