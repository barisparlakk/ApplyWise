from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

import applywise.routes.github as github_route
from applywise.auth import AuthClaims, AuthContext
from applywise.github_analyzer import (
    FetchedGitHubRepository,
    GitHubDeterministicSignals,
    GitHubRepositoryAnalysis,
    GitHubRepositoryAnalysisResult,
)
from applywise.models import Base, GitHubRepository, GitHubRepositoryChunk, User
from applywise.routes.github import (
    AnalyzeGitHubRepositoryPayload,
    analyze_repository,
    list_repositories,
)


def build_analysis_result() -> GitHubRepositoryAnalysisResult:
    repository = FetchedGitHubRepository(
        owner="applywise",
        name="demo",
        full_name="applywise/demo",
        html_url="https://github.com/applywise/demo",
        description="Repository analyzer demo",
        language="Python",
        stars=7,
        default_branch="main",
        readme_text="# Demo\n\nSetup, usage, architecture, testing.",
        languages={"Python": 4000, "TypeScript": 1000},
        file_paths=["src/app.py", "tests/test_app.py", ".github/workflows/ci.yml", "Dockerfile"],
        last_commit_at=datetime(2026, 7, 5, tzinfo=UTC),
    )
    signals = GitHubDeterministicSignals(
        readme_length=len(repository.readme_text),
        has_tests=True,
        has_docker=True,
        has_ci=True,
        has_docs=True,
        has_deployment_config=False,
        file_count=len(repository.file_paths),
        directory_count=3,
        language_count=2,
        top_level_directories=[".github", "src", "tests"],
    )
    analysis = GitHubRepositoryAnalysis(
        readme_quality="Useful",
        tech_stack=["Python", "TypeScript", "Docker", "GitHub Actions"],
        complexity="Moderate",
        commit_activity="Active",
        testing="Tests detected",
        deployment="Containerization detected",
        architecture_signals=["Source directory structure", "CI workflow"],
        missing_documentation=["Deployment notes"],
        best_fit_roles=["Backend Intern", "Software Engineering Intern"],
        strengths=["Good full-stack signal"],
        weaknesses=["Deployment documentation is thin"],
        recommendations=["Add deployment notes"],
    )
    return GitHubRepositoryAnalysisResult(
        repository=repository,
        signals=signals,
        analysis=analysis,
        summary_text="Repository: applywise/demo\nStrengths: Good full-stack signal",
    )


def test_analyze_repository_route_stores_analysis_and_summary_chunks(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    expected_result = build_analysis_result()

    def fake_analyze(repo_url: str, *, github_token: str | None = None):
        assert repo_url == "https://github.com/applywise/demo"
        assert github_token == "github-token"
        return expected_result

    monkeypatch.setattr(github_route, "analyze_github_repository_url", fake_analyze)

    with Session(engine) as session:
        user = User(
            email="github@example.com",
            full_name="GitHub User",
            auth_subject="github:123",
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        auth_context = AuthContext(
            user=user,
            claims=AuthClaims(
                subject="github:123",
                email="github@example.com",
                email_verified=True,
                name="GitHub User",
                github_access_token="github-token",
            ),
        )
        response = analyze_repository(
            AnalyzeGitHubRepositoryPayload(repo_url="https://github.com/applywise/demo"),
            current_auth=auth_context,
            session=session,
        )
        repositories = list_repositories(current_user=user, session=session)
        repo_count = session.scalar(select(func.count()).select_from(GitHubRepository))
        chunk_count = session.scalar(select(func.count()).select_from(GitHubRepositoryChunk))
        saved_chunks = session.scalars(select(GitHubRepositoryChunk)).all()

    assert response.full_name == "applywise/demo"
    assert response.deterministic_signals.has_tests is True
    assert response.analysis.strengths == ["Good full-stack signal"]
    assert response.chunk_count == 1
    assert repositories[0].analysis.best_fit_roles == [
        "Backend Intern",
        "Software Engineering Intern",
    ]
    assert repo_count == 1
    assert chunk_count == 1
    assert saved_chunks[0].embedding_model == "deterministic-sha256-v1-1536"
