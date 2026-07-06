from __future__ import annotations

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.fit_score import FIT_SCORE_WEIGHTS
from applywise.models import Base, FitAnalysis, JobPost, Profile, Project, Resume, User
from applywise.routes.jobs import read_job

embedding_provider = DeterministicEmbeddingProvider()


def test_job_analysis_persists_fit_score_with_weighted_total() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="fit@example.com", full_name="Fit User")
        session.add(user)
        session.flush()
        session.add(
            Profile(
                user_id=user.id,
                education_level="BS Computer Engineering",
                skills=["Python", "SQL", "FastAPI", "Docker"],
                target_roles=["Backend Intern", "AI/ML Intern"],
                languages=[{"name": "English", "level": "B2"}],
                experience_level="Student projects and internship prep",
                github_url="https://github.com/fit-user",
            )
        )
        session.add(
            Resume(
                user_id=user.id,
                filename="fit.pdf",
                content_text="Python SQL FastAPI backend APIs and machine learning projects.",
                parsed_data={
                    "education": ["BS Computer Engineering"],
                    "experience": ["Backend internship project"],
                    "skills": ["Python", "SQL", "FastAPI"],
                    "projects": ["API platform"],
                },
                embedding=embedding_provider.embed(
                    "Python SQL FastAPI backend APIs and machine learning projects."
                ),
            )
        )
        session.add(
            Project(
                user_id=user.id,
                name="Internship tracker API",
                description="FastAPI and PostgreSQL backend for application tracking.",
                skills=["Python", "FastAPI", "PostgreSQL"],
            )
        )
        job_post = JobPost(
            user_id=user.id,
            company_name="ApplyWise Labs",
            title="Backend Intern",
            description=(
                "Backend intern role building Python FastAPI services with SQL, "
                "PostgreSQL, Docker, and English communication."
            ),
            location="Remote",
            source="manual",
            required_skills=["Python", "SQL", "FastAPI", "PostgreSQL"],
            nice_to_have_skills=["Docker"],
            responsibilities=["Build backend APIs"],
            seniority_level="Internship",
            domain="Backend",
            hidden_expectations=["Document tradeoffs"],
            english_requirement="Working proficiency",
            technical_difficulty="Medium",
            business_expectations=["Explain product impact"],
            communication_expectations=["Communicate in English"],
            analysis_data={
                "role_title": "Backend Intern",
                "required_skills": ["Python", "SQL", "FastAPI", "PostgreSQL"],
                "nice_to_have_skills": ["Docker"],
                "responsibilities": ["Build backend APIs"],
                "seniority_level": "Internship",
                "domain": "Backend",
                "hidden_expectations": ["Document tradeoffs"],
                "english_requirement": "Working proficiency",
                "technical_difficulty": "Medium",
                "business_expectations": ["Explain product impact"],
                "communication_expectations": ["Communicate in English"],
            },
            embedding=embedding_provider.embed(
                "Backend intern role building Python FastAPI services with SQL, "
                "PostgreSQL, Docker, and English communication."
            ),
        )
        session.add(job_post)
        session.commit()
        session.refresh(user)
        session.refresh(job_post)

        response = read_job(job_post.id, current_user=user, session=session)
        fit_count = session.scalar(select(func.count()).select_from(FitAnalysis))
        stored_fit = session.scalars(select(FitAnalysis)).one()

    assert response.fit_analysis is not None
    components = response.fit_analysis.components.model_dump()
    expected_total = round(
        sum(components[name] * weight for name, weight in FIT_SCORE_WEIGHTS.items()),
        2,
    )
    assert response.fit_analysis.total_score == expected_total
    assert stored_fit.total_score == expected_total
    assert fit_count == 1
    assert response.fit_analysis.explanation.strong_matches
    assert response.fit_analysis.explanation.weak_areas
    assert response.fit_analysis.explanation.recommended_action
