from __future__ import annotations

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.models import (
    Base,
    InterviewPrep,
    JobPost,
    Profile,
    Project,
    Resume,
    ResumeChunk,
    User,
)
from applywise.routes.applications import create_application_from_job
from applywise.routes.interview_prep import (
    RegenerateInterviewPrepPayload,
    read_interview_prep,
    regenerate_interview_prep,
)

embedding_provider = DeterministicEmbeddingProvider()


def test_interview_prep_generates_grounded_sections_and_regenerates_one_section() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="prep@example.com", full_name="Prep User")
        session.add(user)
        session.flush()
        session.add(
            Profile(
                user_id=user.id,
                education_level="BS Computer Engineering",
                skills=["Python", "FastAPI", "PostgreSQL"],
                target_roles=["Backend Intern"],
                languages=[{"name": "English", "level": "B2"}],
                experience_level="Student projects",
            )
        )
        session.add(
            Project(
                user_id=user.id,
                name="Internship Tracker API",
                description="Built a FastAPI service with PostgreSQL and automated tests.",
                skills=["Python", "FastAPI", "PostgreSQL", "pytest"],
            )
        )
        resume = Resume(
            user_id=user.id,
            filename="prep-user-cv.pdf",
            content_text=(
                "Prep User built backend APIs, wrote pytest tests, and documented PostgreSQL "
                "schema decisions."
            ),
            parsed_data={
                "education": ["BS Computer Engineering"],
                "experience": ["Backend API coursework"],
                "skills": ["Python", "FastAPI", "PostgreSQL"],
                "projects": ["Internship Tracker API"],
            },
            embedding=embedding_provider.embed("Python FastAPI PostgreSQL backend APIs"),
        )
        session.add(resume)
        session.flush()
        session.add(
            ResumeChunk(
                resume_id=resume.id,
                chunk_index=0,
                content="FastAPI service with PostgreSQL, pytest, and deployment notes.",
                embedding=embedding_provider.embed("FastAPI PostgreSQL pytest deployment"),
            )
        )
        job_post = JobPost(
            user_id=user.id,
            company_name="ApplyWise Labs",
            title="Backend Intern",
            description=(
                "Backend internship using Python, FastAPI, PostgreSQL, Docker, CI, "
                "and English communication."
            ),
            source="manual",
            required_skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
            nice_to_have_skills=["CI"],
            responsibilities=["Build APIs", "Explain technical tradeoffs"],
            seniority_level="Internship",
            domain="Backend",
            hidden_expectations=["Readable tests"],
            english_requirement="Working proficiency",
            technical_difficulty="Medium",
            business_expectations=["Communicate progress"],
            communication_expectations=["Explain technical tradeoffs"],
            analysis_data={
                "role_title": "Backend Intern",
                "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
                "nice_to_have_skills": ["CI"],
                "responsibilities": ["Build APIs", "Explain technical tradeoffs"],
                "seniority_level": "Internship",
                "domain": "Backend",
                "hidden_expectations": ["Readable tests"],
                "english_requirement": "Working proficiency",
                "technical_difficulty": "Medium",
                "business_expectations": ["Communicate progress"],
                "communication_expectations": ["Explain technical tradeoffs"],
            },
            embedding=embedding_provider.embed("Backend Python FastAPI PostgreSQL Docker CI"),
        )
        session.add(job_post)
        session.commit()

        application = create_application_from_job(job_post.id, current_user=user, session=session)
        prep = read_interview_prep(application.id, current_user=user, session=session)
        regenerated = regenerate_interview_prep(
            application.id,
            RegenerateInterviewPrepPayload(sections=["technical_questions"]),
            current_user=user,
            session=session,
        )
        prep_count = session.scalar(select(func.count()).select_from(InterviewPrep))

    assert prep.job.company_name == "ApplyWise Labs"
    assert prep.content.technical_questions
    assert prep.content.behavioral_questions
    assert prep.content.english_self_introduction.content
    assert prep.content.project_explanation_script.content
    assert prep.content.why_this_company.content
    assert prep.content.why_this_role.content
    assert prep.content.star_answer_templates
    assert prep.content.weak_area_drill_questions
    assert "Internship Tracker API" in prep.content.project_explanation_script.content
    assert prep.content.technical_questions[0].grounded_evidence
    assert regenerated.id == prep.id
    assert regenerated.content.technical_questions
    assert prep_count == 1
