from __future__ import annotations

from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.models import (
    ApplicationStatus,
    Base,
    FitAnalysis,
    InterviewPrep,
    JobPost,
    User,
)
from applywise.routes.applications import (
    CreateApplicationPayload,
    UpdateApplicationPayload,
    create_application_from_job,
    list_applications,
    read_application,
    update_application,
)


def test_application_tracker_create_list_read_and_update() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="tracker@example.com", full_name="Tracker User")
        session.add(user)
        session.flush()
        job_post = JobPost(
            user_id=user.id,
            company_name="ApplyWise Labs",
            title="Backend Intern",
            description="Backend internship using Python, FastAPI, PostgreSQL, and Docker.",
            location="Remote",
            url="https://example.com/jobs/backend-intern",
            source="manual",
            required_skills=["Python", "FastAPI", "PostgreSQL"],
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
                "required_skills": ["Python", "FastAPI", "PostgreSQL"],
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
        )
        session.add(job_post)
        session.flush()
        fit_analysis = FitAnalysis(
            user_id=user.id,
            job_post_id=job_post.id,
            skill_score=80,
            project_relevance_score=70,
            experience_score=60,
            education_score=90,
            language_score=85,
            domain_score=75,
            profile_quality_score=65,
            total_score=75.25,
            breakdown={},
        )
        session.add(fit_analysis)
        session.commit()

        created = create_application_from_job(
            job_post.id,
            CreateApplicationPayload(
                status=ApplicationStatus.SAVED,
                next_action="Follow up after 7 days",
            ),
            current_user=user,
            session=session,
        )
        session.add(
            InterviewPrep(
                user_id=user.id,
                job_post_id=job_post.id,
                application_id=created.id,
                focus_areas=["Docker"],
                questions=[{"kind": "technical_question", "question": "Explain Docker."}],
            )
        )
        session.commit()

        updated = update_application(
            created.id,
            UpdateApplicationPayload(
                status=ApplicationStatus.INTERVIEW,
                deadline=date(2026, 7, 20),
                job_url="https://example.com/jobs/backend-intern-updated",
                applied_date=date(2026, 7, 10),
                interview_date=date(2026, 7, 18),
                notes="Recruiter screen scheduled.",
                next_action="Prepare project story.",
            ),
            current_user=user,
            session=session,
        )
        listed = list_applications(current_user=user, session=session)
        fetched = read_application(created.id, current_user=user, session=session)

    assert created.company == "ApplyWise Labs"
    assert created.role == "Backend Intern"
    assert created.status == ApplicationStatus.SAVED
    assert created.fit_analysis_id == fit_analysis.id
    assert created.fit_score == 75.25
    assert updated.status == ApplicationStatus.INTERVIEW
    assert updated.deadline == date(2026, 7, 20)
    assert updated.job_url == "https://example.com/jobs/backend-intern-updated"
    assert updated.interview_date == date(2026, 7, 18)
    assert updated.next_action == "Prepare project story."
    assert len(listed) == 1
    assert listed[0].interview_prep_id is not None
    assert fetched.notes == "Recruiter screen scheduled."
