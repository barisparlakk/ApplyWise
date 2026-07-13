from __future__ import annotations

import json

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.interview_prep import build_interview_prep_plan, load_interview_context
from applywise.models import (
    Application,
    Base,
    InterviewPrep,
    JobPost,
    Profile,
    Project,
    Resume,
    ResumeChunk,
    ResumeVersion,
    User,
)
from applywise.routes.applications import create_application_from_job
from applywise.routes.interview_prep import (
    RegenerateInterviewPrepPayload,
    generate_interview_prep,
    read_interview_prep,
    regenerate_interview_prep,
)

embedding_provider = DeterministicEmbeddingProvider()


class FakeInterviewPrepProvider:
    def generate_interview_prep_json(self, payload: dict[str, object]) -> str:
        evidence = payload["evidence"]
        assert isinstance(evidence, list)
        first_evidence = evidence[0]
        assert isinstance(first_evidence, dict)
        evidence_label = str(first_evidence["label"])
        job = payload["job"]
        assert isinstance(job, dict)
        company = str(job["company"])
        role = str(job["role"])
        question = {
            "question": f"How would your evidence help {company}?",
            "guidance": "Use the supplied project evidence and explain one tradeoff.",
            "grounded_evidence": [evidence_label, "Invented evidence"],
            "related_skills": ["FastAPI"],
        }
        script = {
            "content": f"Grounded preparation for {role}.",
            "grounded_evidence": [evidence_label],
        }
        star = {
            "prompt": "Describe a relevant delivery challenge.",
            "situation": "Use the supplied project context.",
            "task": "Explain the objective.",
            "action": "Explain the technical decision and validation.",
            "result": "State only an evidenced result.",
            "grounded_evidence": [evidence_label],
        }
        return json.dumps(
            {
                "focus_areas": ["Company-specific API design"],
                "content": {
                    "technical_questions": [question],
                    "behavioral_questions": [question],
                    "english_self_introduction": script,
                    "project_explanation_script": script,
                    "why_this_company": script,
                    "why_this_role": script,
                    "star_answer_templates": [star],
                    "weak_area_drill_questions": [question],
                },
            }
        )


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
        resume_version = ResumeVersion(
            user_id=user.id,
            source_resume_id=resume.id,
            name="Backend Evidence CV",
            target_role="Backend Intern",
            content_text=resume.content_text,
            parsed_data={
                **resume.parsed_data,
                "experience": ["Role-specific FastAPI delivery evidence"],
            },
        )
        session.add(resume_version)
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
        application_record = session.get(Application, application.id)
        assert application_record is not None
        application_record.resume_version_id = resume_version.id
        session.commit()
        session.refresh(application_record)
        context = load_interview_context(
            session,
            user=user,
            application=application_record,
            job_post=job_post,
        )
        structured_plan = build_interview_prep_plan(
            user=user,
            job_post=job_post,
            context=context,
            provider=FakeInterviewPrepProvider(),
        )
        generated_prep = generate_interview_prep(
            application.id,
            current_user=user,
            session=session,
        )
        prep = read_interview_prep(application.id, current_user=user, session=session)
        regenerated = regenerate_interview_prep(
            application.id,
            RegenerateInterviewPrepPayload(sections=["technical_questions"]),
            current_user=user,
            session=session,
        )
        prep_count = session.scalar(select(func.count()).select_from(InterviewPrep))

    assert generated_prep.id == prep.id
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
    assert structured_plan.focus_areas == ["Company-specific API design"]
    assert context.evidence[1].source == "Selected CV Backend Evidence CV"
    assert structured_plan.content.technical_questions[0].question.startswith(
        "How would your evidence help ApplyWise Labs"
    )
    assert "Invented evidence" not in (
        structured_plan.content.technical_questions[0].grounded_evidence
    )
