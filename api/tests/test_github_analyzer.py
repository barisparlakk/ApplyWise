from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from applywise.github_analyzer import (
    GitHubAnalysisError,
    GitHubQualitativeFeedback,
    GitHubRepositoryAnalysis,
    GitHubRepositoryRef,
    analyze_github_repository_url,
    parse_github_repository_url,
)


class FakeGitHubClient:
    def get_repository(self, owner: str, name: str) -> dict[str, object]:
        return {
            "full_name": f"{owner}/{name}",
            "html_url": f"https://github.com/{owner}/{name}",
            "description": "FastAPI and Next.js internship intelligence prototype.",
            "language": "Python",
            "stargazers_count": 12,
            "default_branch": "main",
        }

    def get_readme_text(self, _owner: str, _name: str) -> str:
        return (
            "# ApplyWise Demo\n\n"
            "## Setup\nRun docker compose.\n\n"
            "## Usage\nAnalyze repositories.\n\n"
            "## Architecture\nFastAPI API, Next.js web, PostgreSQL.\n\n"
            "## Testing\nRun pytest and npm test.\n"
        ) * 12

    def get_languages(self, _owner: str, _name: str) -> dict[str, int]:
        return {"Python": 5000, "TypeScript": 3000, "Dockerfile": 200}

    def get_file_paths(self, _owner: str, _name: str, _branch: str | None) -> list[str]:
        return [
            "api/src/app/main.py",
            "api/tests/test_health.py",
            "web/src/app/page.tsx",
            ".github/workflows/ci.yml",
            "Dockerfile",
            "docker-compose.yml",
            "alembic/versions/0001_initial.py",
        ]

    def get_last_commit_at(self, _owner: str, _name: str) -> datetime:
        return datetime.now(UTC) - timedelta(days=3)


class InvalidOnceFeedbackProvider:
    def __init__(self) -> None:
        self.calls = 0

    def write_qualitative_feedback_json(
        self,
        _repository: object,
        _signals: object,
        _deterministic_analysis: GitHubRepositoryAnalysis,
    ) -> str:
        self.calls += 1
        if self.calls == 1:
            return "{invalid-json"
        return GitHubQualitativeFeedback(
            strengths=["Clear full-stack structure"],
            weaknesses=["Could explain tradeoffs more"],
            recommendations=["Add screenshots to the README"],
        ).model_dump_json()


def test_parse_github_repository_url_supports_common_formats() -> None:
    assert parse_github_repository_url("https://github.com/openai/codex").model_dump() == {
        "owner": "openai",
        "name": "codex",
    }
    assert parse_github_repository_url("git@github.com:owner/repo.git") == GitHubRepositoryRef(
        owner="owner",
        name="repo",
    )
    assert parse_github_repository_url("owner/repo") == GitHubRepositoryRef(
        owner="owner",
        name="repo",
    )


def test_analyzer_builds_deterministic_signals_and_retries_invalid_feedback() -> None:
    provider = InvalidOnceFeedbackProvider()

    result = analyze_github_repository_url(
        "https://github.com/applywise/demo",
        client=FakeGitHubClient(),
        provider=provider,
    )

    assert provider.calls == 2
    assert result.repository.full_name == "applywise/demo"
    assert result.signals.has_tests is True
    assert result.signals.has_docker is True
    assert result.signals.has_ci is True
    assert result.analysis.readme_quality == "Strong"
    assert "Backend Intern" in result.analysis.best_fit_roles
    assert "Software Engineering Intern" in result.analysis.best_fit_roles
    assert result.analysis.strengths == ["Clear full-stack structure"]
    assert "Clear full-stack structure" in result.summary_text


def test_parse_github_repository_url_rejects_non_github_url() -> None:
    with pytest.raises(GitHubAnalysisError):
        parse_github_repository_url("https://example.com/owner/repo")
