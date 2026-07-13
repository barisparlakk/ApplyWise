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
    Resume,
    ResumeVersion,
    User,
)
from applywise.routes.applications import (
    CreateApplicationPayload,
    UpdateApplicationPayload,
    create_application_from_job,
    list_application_events,
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
        resume = Resume(
            user_id=user.id,
            filename="tracker.pdf",
            content_text="Python FastAPI PostgreSQL",
            parsed_data={
                "education": [],
                "experience": ["Backend project"],
                "skills": ["Python", "FastAPI"],
                "projects": ["Tracker API"],
            },
        )
        session.add(resume)
        session.flush()
        resume_version = ResumeVersion(
            user_id=user.id,
            source_resume_id=resume.id,
            name="Backend CV",
            target_role="Backend Intern",
            content_text=resume.content_text,
            parsed_data=resume.parsed_data,
        )
        session.add(resume_version)
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
            breakdown={
                "signals": {"missing_required_skills": ["Docker", "CI"]},
                "explanation": {
                    "strong_matches": ["Python and FastAPI are aligned."],
                    "weak_areas": ["Docker needs proof."],
                    "recommended_action": "Add a small Docker deployment note.",
                },
            },
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
                resume_version_id=resume_version.id,
            ),
            current_user=user,
            session=session,
        )
        listed = list_applications(current_user=user, session=session)
        fetched = read_application(created.id, current_user=user, session=session)
        events = list_application_events(created.id, current_user=user, session=session)
        update_application(
            created.id,
            UpdateApplicationPayload(
                status=updated.status,
                deadline=updated.deadline,
                job_url=updated.job_url,
                applied_date=updated.applied_date,
                interview_date=updated.interview_date,
                notes=updated.notes,
                next_action=updated.next_action,
                resume_version_id=updated.resume_version_id,
            ),
            current_user=user,
            session=session,
        )
        events_after_noop = list_application_events(
            created.id,
            current_user=user,
            session=session,
        )

    assert created.company == "ApplyWise Labs"
    assert created.role == "Backend Intern"
    assert created.status == ApplicationStatus.SAVED
    assert created.fit_analysis_id == fit_analysis.id
    assert created.fit_score == 75.25
    assert created.fit_components is not None
    assert created.fit_components["skill_score"] == 80
    assert created.fit_explanation is not None
    assert created.fit_explanation["recommended_action"] == "Add a small Docker deployment note."
    assert created.missing_skills == ["Docker", "CI"]
    assert updated.status == ApplicationStatus.INTERVIEW
    assert updated.deadline == date(2026, 7, 20)
    assert updated.job_url == "https://example.com/jobs/backend-intern-updated"
    assert updated.interview_date == date(2026, 7, 18)
    assert updated.next_action == "Prepare project story."
    assert updated.resume_version_id == resume_version.id
    assert updated.resume_version_name == "Backend CV"
    assert updated.resume_version_target_role == "Backend Intern"
    assert len(listed) == 1
    assert listed[0].interview_prep_id is not None
    assert fetched.notes == "Recruiter screen scheduled."
    assert [event.event_type for event in events] == ["status_changed", "created"]
    assert events[0].from_status == ApplicationStatus.SAVED
    assert events[0].to_status == ApplicationStatus.INTERVIEW
    assert len(events_after_noop) == len(events)
