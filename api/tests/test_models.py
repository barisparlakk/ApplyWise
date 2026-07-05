from __future__ import annotations

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from applywise.models import (
    ApplicationStatus,
    Base,
    User,
)
from applywise.services import ApplyWiseService


def test_create_and_query_one_of_each_model() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        service = ApplyWiseService(session)
        repositories = service.repositories

        user = repositories.users.create(
            email="ada@example.com",
            full_name="Ada Lovelace",
            auth_subject="auth0|ada",
        )
        repositories.profiles.create(
            user_id=user.id,
            headline="Computer engineering student",
            bio="Interested in ML systems.",
            location="Istanbul",
            education_level="BS",
            target_roles=["AI intern"],
        )
        resume = repositories.resumes.create(
            user_id=user.id,
            filename="ada.pdf",
            content_text="Python, SQL, machine learning",
            parsed_data={"skills": ["Python", "SQL"]},
        )
        repositories.resume_chunks.create(
            resume_id=resume.id,
            chunk_index=0,
            content="Python, SQL, machine learning",
        )
        repositories.projects.create(
            user_id=user.id,
            name="Fraud detection",
            description="A tabular ML project.",
            url="https://example.com/fraud",
            skills=["Python", "scikit-learn"],
        )
        github_repository = repositories.github_repositories.create(
            user_id=user.id,
            owner="ada",
            name="ml-internship",
            full_name="ada/ml-internship",
            html_url="https://github.com/ada/ml-internship",
            description="ML experiments",
            language="Python",
            stars=3,
            summary_text="Repository summary",
        )
        repositories.github_repository_chunks.create(
            repository_id=github_repository.id,
            chunk_index=0,
            content="Model training pipeline chunk",
        )
        repositories.skills.create(name="Python", category="programming")
        job_post = repositories.job_posts.create(
            user_id=user.id,
            company_name="Wise Labs",
            title="AI Engineering Intern",
            description="Build RAG and evaluation tooling.",
            location="Remote",
            url="https://example.com/jobs/1",
            source="manual",
            required_skills=["Python", "SQL", "LLMs"],
        )
        application = repositories.applications.create(
            user_id=user.id,
            job_post_id=job_post.id,
            status=ApplicationStatus.PREPARING,
            notes="Need to review SQL.",
        )
        fit_analysis = repositories.fit_analyses.create(
            user_id=user.id,
            job_post_id=job_post.id,
            skill_score=80,
            project_relevance_score=75,
            experience_score=60,
            education_score=90,
            language_score=85,
            domain_score=70,
            profile_quality_score=65,
            total_score=76.25,
            breakdown={"strengths": ["Python"], "gaps": ["LLM evals"]},
        )
        repositories.interview_preps.create(
            user_id=user.id,
            job_post_id=job_post.id,
            application_id=application.id,
            focus_areas=["SQL", "RAG"],
            questions=[{"question": "Explain vector search."}],
        )
        repositories.learning_roadmaps.create(
            user_id=user.id,
            fit_analysis_id=fit_analysis.id,
            title="RAG readiness",
            items=[{"topic": "pgvector", "status": "todo"}],
        )
        repositories.cover_letters.create(
            user_id=user.id,
            job_post_id=job_post.id,
            application_id=application.id,
            content="Draft content placeholder.",
        )
        repositories.application_notes.create(
            application_id=application.id,
            user_id=user.id,
            body="Applied after improving projects section.",
        )

        session.commit()

        saved_user = session.scalars(select(User).where(User.email == "ada@example.com")).one()

        assert saved_user.profile is not None
        assert len(saved_user.resumes) == 1
        assert len(saved_user.resumes[0].chunks) == 1
        assert len(saved_user.projects) == 1
        assert len(saved_user.github_repositories) == 1
        assert len(saved_user.github_repositories[0].chunks) == 1
        assert len(repositories.skills.list()) == 1
        assert len(saved_user.job_posts) == 1
        assert len(saved_user.applications) == 1
        assert saved_user.applications[0].status == ApplicationStatus.PREPARING
        assert len(saved_user.fit_analyses) == 1
        assert saved_user.fit_analyses[0].total_score == 76.25
        assert len(saved_user.interview_preps) == 1
        assert len(saved_user.learning_roadmaps) == 1
        assert len(saved_user.cover_letters) == 1
        assert len(saved_user.application_notes) == 1
