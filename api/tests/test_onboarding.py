from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from applywise.models import Base, Resume, Skill, User
from applywise.routes.onboarding import (
    OnboardingPayload,
    complete_onboarding,
    read_onboarding_status,
)


def test_onboarding_requires_resume_and_persists_profile_essentials() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="new-user@example.com", full_name="New User")
        session.add(user)
        session.commit()
        session.refresh(user)

        initial_status = read_onboarding_status(current_user=user, session=session)
        assert not initial_status.completed
        assert initial_status.missing_fields == [
            "resume",
            "education",
            "target_roles",
            "experience_level",
            "skills",
            "english_level",
        ]

        payload = OnboardingPayload(
            education="BSc Computer Engineering",
            target_roles=["Backend Intern", "AI/ML Intern"],
            experience_level="Project experience",
            english_level="B2",
            skills=["Python", "SQL", "Python"],
        )
        with pytest.raises(HTTPException) as error:
            complete_onboarding(payload, current_user=user, session=session)
        assert error.value.status_code == 409

        session.add(
            Resume(
                user_id=user.id,
                filename="cv.pdf",
                content_text="Resume text",
                parsed_data={
                    "education": ["BSc Computer Engineering"],
                    "experience": [],
                    "skills": ["Python", "SQL"],
                    "projects": [],
                },
            )
        )
        session.commit()

        completed_status = complete_onboarding(payload, current_user=user, session=session)
        saved_skills = session.scalars(select(Skill).order_by(Skill.name)).all()
        session.refresh(user)

        assert completed_status.completed
        assert completed_status.missing_fields == []
        assert user.profile is not None
        assert user.profile.education_level == "BSc Computer Engineering"
        assert user.profile.target_roles == ["Backend Intern", "AI/ML Intern"]
        assert user.profile.skills == ["Python", "SQL"]
        assert user.profile.languages == [{"name": "English", "level": "B2"}]
        assert [skill.name for skill in saved_skills] == ["Python", "SQL"]
