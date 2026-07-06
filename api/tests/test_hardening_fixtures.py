from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.fit_score import FIT_SCORE_WEIGHTS, compute_and_store_fit_analysis
from applywise.github_analyzer import (
    FetchedGitHubRepository,
    LocalGitHubAnalysisProvider,
    build_deterministic_analysis,
    build_deterministic_signals,
    build_repository_summary,
    extract_qualitative_feedback,
)
from applywise.job_analyzer import analyze_job_post
from applywise.models import (
    Base,
    GitHubRepository,
    GitHubRepositoryChunk,
    JobPost,
    Profile,
    Project,
    Resume,
    User,
)
from applywise.resume_parser import extract_structured_resume

FIXTURE_DIR = Path(__file__).parent / "fixtures"
embedding_provider = DeterministicEmbeddingProvider()


def load_json_fixture(name: str) -> list[dict[str, Any]]:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_resume_fixture_is_parsed_into_core_sections() -> None:
    resume_text = (FIXTURE_DIR / "sample_cv.txt").read_text(encoding="utf-8")

    parsed = extract_structured_resume(resume_text)

    assert parsed.education
    assert parsed.experience
    assert {"Python", "SQL"}.issubset(set(parsed.skills))
    assert parsed.projects


def test_job_post_fixtures_extract_structured_analysis() -> None:
    for fixture in load_json_fixture("sample_job_posts.json"):
        analysis = analyze_job_post(str(fixture["content"]))

        assert analysis.role_title
        assert analysis.required_skills
        assert analysis.responsibilities
        assert analysis.domain
        assert analysis.technical_difficulty in {"Low", "Medium", "High"}


def test_repository_fixtures_build_deterministic_portfolio_signals() -> None:
    for fixture in load_json_fixture("sample_repositories.json"):
        owner, name = str(fixture["full_name"]).split("/", maxsplit=1)
        description = str(fixture.get("description", f"{fixture['full_name']} portfolio repo"))
        repository = FetchedGitHubRepository(
            owner=owner,
            name=name,
            full_name=str(fixture["full_name"]),
            html_url=f"https://github.com/{fixture['full_name']}",
            description=description,
            language=next(iter(dict(fixture["languages"]).keys())),
            stars=int(fixture.get("stars", 0)),
            default_branch="main",
            readme_text=str(fixture["readme_text"]),
            languages=dict(fixture["languages"]),
            file_paths=list(fixture["file_paths"]),
            last_commit_at=datetime.now(UTC) - timedelta(days=14),
        )

        signals = build_deterministic_signals(repository)
        deterministic_analysis = build_deterministic_analysis(repository, signals)
        feedback = extract_qualitative_feedback(
            repository,
            signals,
            deterministic_analysis,
            provider=LocalGitHubAnalysisProvider(),
        )
        analysis = deterministic_analysis.model_copy(
            update={
                "strengths": feedback.strengths,
                "weaknesses": feedback.weaknesses,
                "recommendations": feedback.recommendations,
            }
        )
        summary = build_repository_summary(repository, signals, analysis)

        assert signals.file_count == len(fixture["file_paths"])
        assert analysis.tech_stack
        assert analysis.best_fit_roles
        assert analysis.strengths
        assert repository.full_name in summary


def test_fixture_profile_scores_job_with_documented_weighting() -> None:
    jobs = load_json_fixture("sample_job_posts.json")
    repositories = load_json_fixture("sample_repositories.json")
    job_analysis = analyze_job_post(str(jobs[0]["content"]))
    resume_text = (FIXTURE_DIR / "sample_cv.txt").read_text(encoding="utf-8")
    parsed_resume = extract_structured_resume(resume_text)
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="fixture@example.com", full_name="Fixture Student")
        session.add(user)
        session.flush()

        session.add(
            Profile(
                user_id=user.id,
                education_level="BS Computer Engineering",
                skills=parsed_resume.skills + ["FastAPI", "PostgreSQL", "Docker"],
                target_roles=["AI/ML Intern", "Backend Intern"],
                languages=[{"name": "English", "level": "B2"}],
                experience_level="Student projects and internship prep",
                github_url="https://github.com/applywise-demo",
                preferred_location="Remote",
                internship_type="Summer internship",
            )
        )
        session.add(
            Resume(
                user_id=user.id,
                filename="sample_cv.txt",
                content_text=resume_text,
                parsed_data=parsed_resume.model_dump(),
                embedding=embedding_provider.embed(resume_text),
            )
        )
        session.add(
            Project(
                user_id=user.id,
                name="Internship Intelligence API",
                description=(
                    "FastAPI and PostgreSQL service for scoring internship fit "
                    "with vector search and deterministic signals."
                ),
                skills=["Python", "FastAPI", "PostgreSQL", "RAG"],
            )
        )

        for fixture in repositories:
            owner, name = str(fixture["full_name"]).split("/", maxsplit=1)
            repository_summary = str(
                fixture.get(
                    "summary_text",
                    f"{fixture['full_name']} uses {', '.join(dict(fixture['languages']).keys())}. "
                    f"{fixture['readme_text']}",
                )
            )
            repository = GitHubRepository(
                user_id=user.id,
                owner=owner,
                name=name,
                full_name=str(fixture["full_name"]),
                html_url=f"https://github.com/{fixture['full_name']}",
                description=str(
                    fixture.get("description", f"{fixture['full_name']} portfolio repo")
                ),
                language=next(iter(dict(fixture["languages"]).keys())),
                stars=int(fixture.get("stars", 0)),
                default_branch="main",
                readme_text=str(fixture["readme_text"]),
                languages=dict(fixture["languages"]),
                file_tree=list(fixture["file_paths"]),
                deterministic_signals=dict(fixture.get("deterministic_signals", {})),
                analysis_data=dict(fixture.get("analysis_data", {})),
                summary_text=repository_summary,
            )
            session.add(repository)
            session.flush()
            session.add(
                GitHubRepositoryChunk(
                    repository_id=repository.id,
                    chunk_index=0,
                    content=repository_summary,
                    embedding=embedding_provider.embed(repository_summary),
                )
            )

        job_post = JobPost(
            user_id=user.id,
            company_name=str(jobs[0]["company"]),
            title=job_analysis.role_title,
            description=str(jobs[0]["content"]),
            location=str(jobs[0].get("location", "Remote")),
            source="fixture",
            required_skills=job_analysis.required_skills,
            nice_to_have_skills=job_analysis.nice_to_have_skills,
            responsibilities=job_analysis.responsibilities,
            seniority_level=job_analysis.seniority_level,
            domain=job_analysis.domain,
            hidden_expectations=job_analysis.hidden_expectations,
            english_requirement=job_analysis.english_requirement,
            technical_difficulty=job_analysis.technical_difficulty,
            business_expectations=job_analysis.business_expectations,
            communication_expectations=job_analysis.communication_expectations,
            analysis_data=job_analysis.model_dump(),
            embedding=embedding_provider.embed(str(jobs[0]["content"])),
        )
        session.add(job_post)
        session.commit()
        session.refresh(user)
        session.refresh(job_post)

        fit_analysis = compute_and_store_fit_analysis(
            session,
            user=user,
            job_post=job_post,
        )

        components = fit_analysis.breakdown["components"]
        expected_total = round(
            sum(components[name] * weight for name, weight in FIT_SCORE_WEIGHTS.items()),
            2,
        )

        assert fit_analysis.total_score == expected_total
        assert fit_analysis.skill_score == components["skill_score"]
        assert fit_analysis.breakdown["signals"]["matched_skills"]
        assert fit_analysis.breakdown["explanation"]["recommended_action"]
