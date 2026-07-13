from __future__ import annotations

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.models import (
    Base,
    JobPost,
    JobSkillMapping,
    Profile,
    SkillPrerequisite,
    User,
)
from applywise.routes.skill_graph import read_job_skill_graph


def test_job_skill_graph_maps_requirements_and_finds_shortest_readiness_paths() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="graph@example.com", full_name="Graph User")
        session.add(user)
        session.flush()
        profile = Profile(
            user_id=user.id,
            skills=["Python", "SQL"],
            target_roles=["Backend Intern"],
        )
        session.add(profile)
        job_post = JobPost(
            user_id=user.id,
            company_name="Graph Labs",
            title="Backend Platform Intern",
            description="Build FastAPI, PostgreSQL, and Kubernetes services.",
            required_skills=["FastAPI", "PostgreSQL", "Kubernetes"],
            nice_to_have_skills=["CI/CD"],
            responsibilities=["Build APIs"],
            seniority_level="Internship",
            domain="Backend",
            hidden_expectations=[],
            english_requirement="Working proficiency",
            technical_difficulty="Medium",
            business_expectations=[],
            communication_expectations=[],
            analysis_data={},
        )
        session.add(job_post)
        session.commit()
        session.refresh(user)
        session.refresh(job_post)

        graph = read_job_skill_graph(
            job_post.id,
            current_user=user,
            session=session,
        )
        profile.skills = ["Python", "SQL", "FastAPI", "PostgreSQL"]
        session.commit()
        improved_graph = read_job_skill_graph(
            job_post.id,
            current_user=user,
            session=session,
        )
        mapping_count = session.scalar(select(func.count()).select_from(JobSkillMapping))
        edge_count = session.scalar(select(func.count()).select_from(SkillPrerequisite))

    fastapi_path = next(path for path in graph.paths if path.target_skill == "FastAPI")
    kubernetes_path = next(path for path in graph.paths if path.target_skill == "Kubernetes")
    assert [node.name for node in fastapi_path.nodes] == ["Python", "FastAPI"]
    assert [node.name for node in kubernetes_path.nodes] == [
        "Linux",
        "Docker",
        "Kubernetes",
    ]
    assert graph.readiness_percent == 0
    assert improved_graph.readiness_percent == 66.67
    assert "Docker" in improved_graph.recommended_sequence
    assert mapping_count == 4
    assert edge_count == 20
