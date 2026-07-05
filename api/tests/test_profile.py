from __future__ import annotations

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.models import Base, Project, Skill, User
from applywise.routes.profile import (
    ProfilePayload,
    ProjectsPayload,
    SkillPayload,
    read_profile,
    replace_projects,
    update_profile,
    update_skills,
)


def test_profile_builder_endpoints_persist_profile_skills_and_projects() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="profile@example.com", full_name="Profile User")
        session.add(user)
        session.commit()
        session.refresh(user)

        profile_response = update_profile(
            ProfilePayload(
                education="Computer Engineering, 3rd year",
                github_url="https://github.com/profile-user",
                target_roles=["AI/ML Intern", "Backend Intern"],
                preferred_location="Remote",
                internship_type="Full-time",
                languages=[
                    {"name": "English", "level": "C1"},
                    {"name": "Turkish", "level": "Native"},
                ],
                experience_level="Project experience",
            ),
            current_user=user,
            session=session,
        )
        skills_response = update_skills(
            SkillPayload(skills=["Python", "SQL", "Python"]),
            current_user=user,
            session=session,
        )
        projects_response = replace_projects(
            ProjectsPayload(
                projects=[
                    {
                        "name": "RAG Assistant",
                        "description": "FastAPI and pgvector project",
                        "url": "https://github.com/profile-user/rag",
                        "skills": ["Python", "PostgreSQL"],
                    }
                ]
            ),
            current_user=user,
            session=session,
        )

        saved_profile = read_profile(current_user=user, session=session)
        saved_project_count = session.scalar(
            select(func.count()).select_from(Project).where(Project.user_id == user.id)
        )
        saved_skills = session.scalars(select(Skill).order_by(Skill.name)).all()

    assert profile_response.education == "Computer Engineering, 3rd year"
    assert skills_response.skills == ["Python", "SQL"]
    assert len(projects_response) == 1
    assert saved_profile.profile.github_url == "https://github.com/profile-user"
    assert saved_profile.profile.target_roles == ["AI/ML Intern", "Backend Intern"]
    assert saved_profile.profile.skills == ["Python", "SQL"]
    assert saved_profile.projects[0].name == "RAG Assistant"
    assert saved_project_count == 1
    assert [skill.name for skill in saved_skills] == ["Python", "SQL"]
