from __future__ import annotations

import json
from datetime import date

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.fit_score import compute_and_store_fit_analysis
from applywise.models import Base, JobPost, LearningRoadmap, Profile, Project, User
from applywise.roadmap import (
    MissingSkill,
    build_and_store_roadmap,
    build_dated_plan,
    generate_roadmap_days,
    roadmap_to_plan,
)

embedding_provider = DeterministicEmbeddingProvider()


class FakeRoadmapProvider:
    def __init__(self) -> None:
        self.calls = 0

    def generate_roadmap_json(self, **kwargs: object) -> str:
        self.calls += 1
        duration_days = int(kwargs["duration_days"])
        return json.dumps(
            {
                "plan": [
                    {
                        "day": day,
                        "focus": f"Custom role focus {day}",
                        "tasks": [
                            f"Build role artifact {day}",
                            f"Validate responsibility {day}",
                        ],
                        "outcome": f"Evidence checkpoint {day}",
                    }
                    for day in range(1, duration_days + 1)
                ]
            }
        )


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
        unused_provider = FakeRoadmapProvider()
        same_roadmap = build_and_store_roadmap(
            session,
            user=user,
            fit_analysis=fit_analysis,
            job_post=job_post,
            duration_days=7,
            provider=unused_provider,
        )
        session.commit()
        plan = roadmap_to_plan(roadmap, job_post)
        roadmap_count = session.scalar(select(func.count()).select_from(LearningRoadmap))

    assert roadmap_count == 1
    assert same_roadmap.id == roadmap.id
    assert unused_provider.calls == 0
    assert plan.duration_days == 7
    assert len(plan.plan) == 7
    assert plan.missing_skills[0].name in {"SQL", "FastAPI", "PostgreSQL"}
    assert plan.missing_skills[0].impact_score >= plan.missing_skills[-1].impact_score
    assert plan.plan[0].date.isoformat()
    assert plan.plan[0].tasks
    assert any("Build APIs" in task for task in plan.plan[0].tasks)


def test_roadmap_tasks_change_with_role_and_responsibility() -> None:
    backend_job = JobPost(
        user_id=None,
        company_name="Northstar",
        title="Backend Intern",
        description="Build APIs with SQL.",
        required_skills=["SQL"],
        nice_to_have_skills=[],
        responsibilities=["Design reliable reporting APIs"],
        domain="Backend",
        hidden_expectations=[],
        business_expectations=[],
        communication_expectations=[],
    )
    ml_job = JobPost(
        user_id=None,
        company_name="Vision Labs",
        title="AI/ML Intern",
        description="Evaluate image models.",
        required_skills=["Computer Vision"],
        nice_to_have_skills=[],
        responsibilities=["Evaluate model failure cases"],
        domain="Computer Vision",
        hidden_expectations=[],
        business_expectations=[],
        communication_expectations=[],
    )

    backend_plan = build_dated_plan(
        missing_skills=[
            MissingSkill(rank=1, name="SQL", impact_score=90, reason="Required skill")
        ],
        job_post=backend_job,
        duration_days=3,
        start_date=date(2026, 7, 11),
    )
    ml_plan = build_dated_plan(
        missing_skills=[
            MissingSkill(
                rank=1,
                name="Computer Vision",
                impact_score=90,
                reason="Required skill",
            )
        ],
        job_post=ml_job,
        duration_days=3,
        start_date=date(2026, 7, 11),
    )

    assert backend_plan[0].tasks != ml_plan[0].tasks
    assert any("Design reliable reporting APIs" in task for task in backend_plan[0].tasks)
    assert any("Evaluate model failure cases" in task for task in ml_plan[0].tasks)


def test_structured_roadmap_provider_controls_role_specific_plan() -> None:
    user = User(email="generated-roadmap@example.com", full_name="Generated User")
    job_post = JobPost(
        user_id=None,
        company_name="Northstar",
        title="Backend Intern",
        description="Build reliable reporting APIs.",
        required_skills=["SQL"],
        nice_to_have_skills=[],
        responsibilities=["Design reliable reporting APIs"],
        domain="Backend",
        hidden_expectations=[],
        business_expectations=[],
        communication_expectations=[],
    )
    fit_analysis = type(
        "FitAnalysisStub",
        (),
        {"total_score": 58.0, "breakdown": {"components": {"skill_score": 45.0}}},
    )()
    provider = FakeRoadmapProvider()

    plan = generate_roadmap_days(
        user=user,
        fit_analysis=fit_analysis,
        missing_skills=[
            MissingSkill(rank=1, name="SQL", impact_score=90, reason="Required skill")
        ],
        job_post=job_post,
        duration_days=3,
        start_date=date(2026, 7, 13),
        provider=provider,
    )

    assert provider.calls == 1
    assert [day.focus for day in plan] == [
        "Custom role focus 1",
        "Custom role focus 2",
        "Custom role focus 3",
    ]
    assert plan[2].date == date(2026, 7, 15)
