from __future__ import annotations

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.fit_score import compute_and_store_fit_analysis
from applywise.models import Base, JobPost, LearningRoadmap, Profile, Project, User
from applywise.roadmap import build_and_store_roadmap, roadmap_to_plan

embedding_provider = DeterministicEmbeddingProvider()


def test_roadmap_ranks_missing_skills_and_builds_dated_plan() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="roadmap@example.com", full_name="Roadmap User")
        session.add(user)
        session.flush()
        session.add(
            Profile(
                user_id=user.id,
                education_level="BS Computer Engineering",
                skills=["Python"],
                target_roles=["Backend Intern"],
                languages=[{"name": "English", "level": "B2"}],
                experience_level="Student projects",
            )
        )
        session.add(
            Project(
                user_id=user.id,
                name="Python API",
                description="Small backend API.",
                skills=["Python"],
            )
        )
        job_post = JobPost(
            user_id=user.id,
            company_name="ApplyWise Labs",
            title="Backend Intern",
            description="Backend internship using Python, SQL, FastAPI, PostgreSQL, and Docker.",
            source="manual",
            required_skills=["Python", "SQL", "FastAPI", "PostgreSQL"],
            nice_to_have_skills=["Docker"],
            responsibilities=["Build APIs"],
            seniority_level="Internship",
            domain="Backend",
            hidden_expectations=[],
            english_requirement="Working proficiency",
            technical_difficulty="Medium",
            business_expectations=[],
            communication_expectations=[],
            analysis_data={
                "role_title": "Backend Intern",
                "required_skills": ["Python", "SQL", "FastAPI", "PostgreSQL"],
                "nice_to_have_skills": ["Docker"],
                "responsibilities": ["Build APIs"],
                "seniority_level": "Internship",
                "domain": "Backend",
                "hidden_expectations": [],
                "english_requirement": "Working proficiency",
                "technical_difficulty": "Medium",
                "business_expectations": [],
                "communication_expectations": [],
            },
            embedding=embedding_provider.embed(
                "Backend internship using Python, SQL, FastAPI, PostgreSQL, and Docker."
            ),
        )
        session.add(job_post)
        session.flush()

        fit_analysis = compute_and_store_fit_analysis(session, user=user, job_post=job_post)
        roadmap = build_and_store_roadmap(
            session,
            user=user,
            fit_analysis=fit_analysis,
            job_post=job_post,
            duration_days=7,
        )
        session.commit()
        plan = roadmap_to_plan(roadmap, job_post)
        roadmap_count = session.scalar(select(func.count()).select_from(LearningRoadmap))

    assert roadmap_count == 1
    assert plan.duration_days == 7
    assert len(plan.plan) == 7
    assert plan.missing_skills[0].name in {"SQL", "FastAPI", "PostgreSQL"}
    assert plan.missing_skills[0].impact_score >= plan.missing_skills[-1].impact_score
    assert plan.plan[0].date.isoformat()
    assert plan.plan[0].tasks
