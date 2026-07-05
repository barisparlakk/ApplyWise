from __future__ import annotations

import base64
import json
import os
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field, ValidationError, field_validator

TARGET_ROLES = (
    "Data Science Intern",
    "AI/ML Intern",
    "Backend Intern",
    "Image Processing Intern",
    "Software Engineering Intern",
    "Business Analyst Intern",
    "Process Improvement Intern",
)

GITHUB_API_VERSION = "2022-11-28"
DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com"


class GitHubAnalysisError(RuntimeError):
    pass


class GitHubRequestError(GitHubAnalysisError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


class GitHubRepositoryRef(BaseModel):
    owner: str = Field(max_length=120)
    name: str = Field(max_length=255)

    @field_validator("owner", "name")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        stripped = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", stripped):
            raise ValueError("GitHub repository owner and name must be valid slugs.")
        return stripped.removesuffix(".git")


class GitHubDeterministicSignals(BaseModel):
    readme_length: int
    has_tests: bool
    has_docker: bool
    has_ci: bool
    has_docs: bool
    has_deployment_config: bool
    file_count: int
    directory_count: int
    language_count: int
    top_level_directories: list[str] = Field(default_factory=list)


class GitHubRepositoryAnalysis(BaseModel):
    readme_quality: str
    tech_stack: list[str] = Field(default_factory=list)
    complexity: str
    commit_activity: str
    testing: str
    deployment: str
    architecture_signals: list[str] = Field(default_factory=list)
    missing_documentation: list[str] = Field(default_factory=list)
    best_fit_roles: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class GitHubQualitativeFeedback(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)

    @field_validator("strengths", "weaknesses", "recommendations")
    @classmethod
    def clean_items(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for value in values:
            stripped = value.strip()
            key = stripped.lower()
            if stripped and key not in seen:
                cleaned.append(stripped)
                seen.add(key)
        return cleaned[:6]


class GitHubAnalysisProvider(Protocol):
    def write_qualitative_feedback_json(
        self,
        repository: FetchedGitHubRepository,
        signals: GitHubDeterministicSignals,
        deterministic_analysis: GitHubRepositoryAnalysis,
    ) -> str:
        pass


@dataclass(frozen=True)
class FetchedGitHubRepository:
    owner: str
    name: str
    full_name: str
    html_url: str
    description: str | None
    language: str | None
    stars: int
    default_branch: str | None
    readme_text: str
    languages: dict[str, int]
    file_paths: list[str]
    last_commit_at: datetime | None


@dataclass(frozen=True)
class GitHubRepositoryAnalysisResult:
    repository: FetchedGitHubRepository
    signals: GitHubDeterministicSignals
    analysis: GitHubRepositoryAnalysis
    summary_text: str


class GitHubClient:
    def __init__(
        self,
        *,
        token: str | None = None,
        api_base_url: str = DEFAULT_GITHUB_API_BASE_URL,
        timeout_seconds: float = 20,
    ) -> None:
        self.token = token
        self.api_base_url = api_base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def get_repository(self, owner: str, name: str) -> dict[str, Any]:
        return self._request_json(f"/repos/{owner}/{name}")

    def get_readme_text(self, owner: str, name: str) -> str:
        try:
            response = self._request_json(f"/repos/{owner}/{name}/readme")
        except GitHubRequestError as exc:
            if exc.status_code == 404:
                return ""
            raise

        content = response.get("content")
        encoding = response.get("encoding")
        if not isinstance(content, str) or encoding != "base64":
            return ""
        return base64.b64decode(content).decode("utf-8", errors="replace").strip()

    def get_languages(self, owner: str, name: str) -> dict[str, int]:
        try:
            response = self._request_json(f"/repos/{owner}/{name}/languages")
        except GitHubRequestError as exc:
            if exc.status_code == 404:
                return {}
            raise

        return {
            language: bytes_count
            for language, bytes_count in response.items()
            if isinstance(language, str) and isinstance(bytes_count, int)
        }

    def get_file_paths(self, owner: str, name: str, branch: str | None) -> list[str]:
        if not branch:
            return []

        try:
            response = self._request_json(
                f"/repos/{owner}/{name}/git/trees/{branch}",
                query={"recursive": "1"},
            )
        except GitHubRequestError as exc:
            if exc.status_code == 404:
                return []
            raise

        tree = response.get("tree")
        if not isinstance(tree, list):
            return []

        file_paths: list[str] = []
        for item in tree:
            if isinstance(item, dict) and isinstance(item.get("path"), str):
                file_paths.append(item["path"])
        return file_paths

    def get_last_commit_at(self, owner: str, name: str) -> datetime | None:
        try:
            response = self._request_json(
                f"/repos/{owner}/{name}/commits",
                query={"per_page": "1"},
            )
        except GitHubRequestError as exc:
            if exc.status_code == 404:
                return None
            raise

        if not isinstance(response, list) or not response:
            return None

        first_commit = response[0]
        if not isinstance(first_commit, dict):
            return None

        commit = first_commit.get("commit")
        if not isinstance(commit, dict):
            return None

        committer = commit.get("committer")
        if not isinstance(committer, dict) or not isinstance(committer.get("date"), str):
            return None

        return parse_github_datetime(committer["date"])

    def _request_json(self, path: str, query: Mapping[str, str] | None = None) -> Any:
        url = f"{self.api_base_url}{path}"
        if query:
            url = f"{url}?{urlencode(query)}"

        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "ApplyWise-GitHub-Analyzer",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        request = Request(url, headers=headers, method="GET")
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                return json.loads(response.read())
        except HTTPError as exc:
            raise GitHubRequestError(exc.code, parse_error_message(exc)) from exc
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise GitHubAnalysisError("GitHub request failed.") from exc


class LocalGitHubAnalysisProvider:
    def write_qualitative_feedback_json(
        self,
        repository: FetchedGitHubRepository,
        signals: GitHubDeterministicSignals,
        deterministic_analysis: GitHubRepositoryAnalysis,
    ) -> str:
        strengths: list[str] = []
        weaknesses: list[str] = []
        recommendations: list[str] = []

        if deterministic_analysis.readme_quality in {"Useful", "Strong"}:
            strengths.append("README gives reviewers enough context to understand the project.")
        if signals.has_tests:
            strengths.append("Test files are present, which improves internship portfolio signal.")
        if signals.has_docker:
            strengths.append("Containerization signals deployment awareness.")
        if signals.has_ci:
            strengths.append("CI configuration shows attention to repeatable quality checks.")
        if deterministic_analysis.complexity in {"Moderate", "High"}:
            strengths.append(
                "The repository has enough structure to discuss implementation choices."
            )
        if not strengths:
            strengths.append(
                "The repository is analyzable and can be improved into a clearer portfolio asset."
            )

        if deterministic_analysis.readme_quality in {"Missing", "Thin"}:
            weaknesses.append("README context is too limited for a recruiter or interviewer.")
        if not signals.has_tests:
            weaknesses.append("No clear test suite was detected.")
        if not signals.has_ci:
            weaknesses.append("No CI workflow was detected.")
        if deterministic_analysis.missing_documentation:
            weaknesses.append(
                f"Missing documentation: {', '.join(deterministic_analysis.missing_documentation)}."
            )
        if not weaknesses:
            weaknesses.append(
                "Main gaps are incremental polish rather than core repository structure."
            )

        if "Testing instructions" in deterministic_analysis.missing_documentation:
            recommendations.append("Add test commands and expected results to the README.")
        if not signals.has_tests:
            recommendations.append(
                "Add focused unit or integration tests around the core workflow."
            )
        if not signals.has_docker and deterministic_analysis.complexity != "Small":
            recommendations.append(
                "Add a Dockerfile or Compose file if local setup has multiple services."
            )
        if "Architecture notes" in deterministic_analysis.missing_documentation:
            recommendations.append(
                "Document the main modules and data flow in a short architecture section."
            )
        if not recommendations:
            recommendations.append("Tighten project framing around the best-fit internship roles.")

        return GitHubQualitativeFeedback(
            strengths=strengths,
            weaknesses=weaknesses,
            recommendations=recommendations,
        ).model_dump_json()


class OpenAICompatibleGitHubAnalysisProvider:
    def __init__(
        self,
        *,
        api_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 30,
    ) -> None:
        self.api_url = api_url
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def write_qualitative_feedback_json(
        self,
        repository: FetchedGitHubRepository,
        signals: GitHubDeterministicSignals,
        deterministic_analysis: GitHubRepositoryAnalysis,
    ) -> str:
        context = {
            "repository": {
                "full_name": repository.full_name,
                "description": repository.description,
                "stars": repository.stars,
                "languages": repository.languages,
                "last_commit_at": repository.last_commit_at.isoformat()
                if repository.last_commit_at
                else None,
            },
            "signals": signals.model_dump(mode="json"),
            "analysis": deterministic_analysis.model_dump(mode="json"),
            "readme_excerpt": repository.readme_text[:4000],
            "file_tree_sample": repository.file_paths[:250],
        }
        payload = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Write qualitative GitHub portfolio feedback as JSON only. "
                        "Return exactly these keys with string-array values: "
                        "strengths, weaknesses, recommendations. "
                        "Do not invent deterministic scores or repository facts."
                    ),
                },
                {"role": "user", "content": json.dumps(context, separators=(",", ":"))},
            ],
        }
        request = Request(
            self.api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                response_data = json.loads(response.read())
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise GitHubAnalysisError("LLM repository analysis request failed.") from exc

        content = extract_llm_message_content(response_data)
        if content is None:
            raise GitHubAnalysisError("LLM repository analysis response was not understood.")
        return content


def parse_github_repository_url(value: str) -> GitHubRepositoryRef:
    raw_value = value.strip()
    shorthand = re.fullmatch(r"([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:\.git)?", raw_value)
    if shorthand:
        return GitHubRepositoryRef(owner=shorthand.group(1), name=shorthand.group(2))

    ssh_match = re.fullmatch(
        r"git@github\.com:([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:\.git)?",
        raw_value,
    )
    if ssh_match:
        return GitHubRepositoryRef(owner=ssh_match.group(1), name=ssh_match.group(2))

    parsed = urlparse(raw_value)
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() not in {
        "github.com",
        "www.github.com",
    }:
        raise GitHubAnalysisError("Repository URL must point to github.com.")

    path_parts = [part for part in parsed.path.split("/") if part]
    if len(path_parts) < 2:
        raise GitHubAnalysisError("Repository URL must include owner and repository name.")

    return GitHubRepositoryRef(owner=path_parts[0], name=path_parts[1].removesuffix(".git"))


def analyze_github_repository_url(
    repo_url: str,
    *,
    github_token: str | None = None,
    client: GitHubClient | None = None,
    provider: GitHubAnalysisProvider | None = None,
) -> GitHubRepositoryAnalysisResult:
    ref = parse_github_repository_url(repo_url)
    github_client = client or GitHubClient(token=github_token)
    repository = fetch_repository(ref, github_client)
    signals = build_deterministic_signals(repository)
    deterministic_analysis = build_deterministic_analysis(repository, signals)
    feedback = extract_qualitative_feedback(
        repository,
        signals,
        deterministic_analysis,
        provider=provider,
    )
    analysis = deterministic_analysis.model_copy(
        update={
            "strengths": feedback.strengths,
            "weaknesses": feedback.weaknesses,
            "recommendations": feedback.recommendations,
        }
    )
    summary_text = build_repository_summary(repository, signals, analysis)
    return GitHubRepositoryAnalysisResult(
        repository=repository,
        signals=signals,
        analysis=analysis,
        summary_text=summary_text,
    )


def fetch_repository(ref: GitHubRepositoryRef, client: GitHubClient) -> FetchedGitHubRepository:
    metadata = client.get_repository(ref.owner, ref.name)
    full_name = require_string(metadata, "full_name")
    owner, name = full_name.split("/", maxsplit=1)
    default_branch = metadata.get("default_branch")
    readme_text = client.get_readme_text(owner, name)
    languages = client.get_languages(owner, name)
    file_paths = client.get_file_paths(
        owner,
        name,
        default_branch if isinstance(default_branch, str) else None,
    )
    last_commit_at = client.get_last_commit_at(owner, name)
    description = metadata.get("description")
    language = metadata.get("language")
    stars = metadata.get("stargazers_count")

    return FetchedGitHubRepository(
        owner=owner,
        name=name,
        full_name=full_name,
        html_url=require_string(metadata, "html_url"),
        description=description if isinstance(description, str) else None,
        language=language if isinstance(language, str) else None,
        stars=stars if isinstance(stars, int) else 0,
        default_branch=default_branch if isinstance(default_branch, str) else None,
        readme_text=readme_text,
        languages=languages,
        file_paths=file_paths,
        last_commit_at=last_commit_at,
    )


def build_deterministic_signals(repository: FetchedGitHubRepository) -> GitHubDeterministicSignals:
    lower_paths = [path.lower() for path in repository.file_paths]
    directory_names = directories_from_paths(repository.file_paths)
    top_level_directories = sorted(
        {path.split("/", maxsplit=1)[0] for path in repository.file_paths if "/" in path}
    )

    return GitHubDeterministicSignals(
        readme_length=len(repository.readme_text),
        has_tests=has_tests(lower_paths),
        has_docker=has_docker(lower_paths),
        has_ci=has_ci(lower_paths),
        has_docs=has_docs(lower_paths, repository.readme_text),
        has_deployment_config=has_deployment_config(lower_paths),
        file_count=len(repository.file_paths),
        directory_count=len(directory_names),
        language_count=len(repository.languages),
        top_level_directories=top_level_directories[:20],
    )


def build_deterministic_analysis(
    repository: FetchedGitHubRepository,
    signals: GitHubDeterministicSignals,
) -> GitHubRepositoryAnalysis:
    readme_quality = classify_readme_quality(repository.readme_text)
    tech_stack = infer_tech_stack(repository.languages, repository.file_paths)
    complexity = classify_complexity(signals)
    commit_activity = classify_commit_activity(repository.last_commit_at)
    missing_documentation = find_missing_documentation(repository.readme_text, signals)

    return GitHubRepositoryAnalysis(
        readme_quality=readme_quality,
        tech_stack=tech_stack,
        complexity=complexity,
        commit_activity=commit_activity,
        testing="Tests detected" if signals.has_tests else "No clear tests detected",
        deployment=classify_deployment(signals),
        architecture_signals=infer_architecture_signals(repository.file_paths, signals),
        missing_documentation=missing_documentation,
        best_fit_roles=infer_best_fit_roles(
            repository.languages,
            repository.file_paths,
            tech_stack,
        ),
        strengths=[],
        weaknesses=[],
        recommendations=[],
    )


def extract_qualitative_feedback(
    repository: FetchedGitHubRepository,
    signals: GitHubDeterministicSignals,
    deterministic_analysis: GitHubRepositoryAnalysis,
    *,
    provider: GitHubAnalysisProvider | None = None,
) -> GitHubQualitativeFeedback:
    feedback_provider = provider or get_github_analysis_provider()
    last_error: Exception | None = None

    for _attempt in range(2):
        try:
            feedback = GitHubQualitativeFeedback.model_validate_json(
                feedback_provider.write_qualitative_feedback_json(
                    repository,
                    signals,
                    deterministic_analysis,
                )
            )
            return ensure_feedback_defaults(feedback)
        except (ValidationError, ValueError) as exc:
            last_error = exc

    raise GitHubAnalysisError(
        "Repository analysis returned invalid structured output."
    ) from last_error


def get_github_analysis_provider() -> GitHubAnalysisProvider:
    provider = os.environ.get("LLM_PROVIDER", "local").strip().lower()
    if provider in {"", "local", "heuristic"}:
        return LocalGitHubAnalysisProvider()

    if provider in {"openai", "openai-compatible"}:
        api_url = os.environ.get("LLM_API_URL", "").strip()
        api_key = os.environ.get("LLM_API_KEY", "").strip()
        model = os.environ.get("LLM_MODEL", "").strip()
        if not api_url or not api_key or not model:
            raise GitHubAnalysisError("LLM provider is not fully configured.")

        timeout_seconds = float(os.environ.get("LLM_TIMEOUT_SECONDS", "30"))
        return OpenAICompatibleGitHubAnalysisProvider(
            api_url=api_url,
            api_key=api_key,
            model=model,
            timeout_seconds=timeout_seconds,
        )

    raise GitHubAnalysisError(f"Unsupported LLM provider: {provider}.")


def ensure_feedback_defaults(feedback: GitHubQualitativeFeedback) -> GitHubQualitativeFeedback:
    return GitHubQualitativeFeedback(
        strengths=feedback.strengths or ["Repository has enough public metadata for analysis."],
        weaknesses=feedback.weaknesses
        or ["No major weaknesses were identified from metadata alone."],
        recommendations=feedback.recommendations or ["Keep documentation and tests current."],
    )


def parse_github_datetime(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def parse_error_message(error: HTTPError) -> str:
    try:
        payload = json.loads(error.read())
    except (json.JSONDecodeError, OSError):
        return f"GitHub request failed with status {error.code}."

    message = payload.get("message") if isinstance(payload, dict) else None
    if isinstance(message, str):
        return message
    return f"GitHub request failed with status {error.code}."


def require_string(mapping: Mapping[str, Any], key: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value:
        raise GitHubAnalysisError(f"GitHub response was missing {key}.")
    return value


def directories_from_paths(paths: Sequence[str]) -> set[str]:
    directories: set[str] = set()
    for path in paths:
        parts = path.split("/")[:-1]
        current = ""
        for part in parts:
            current = f"{current}/{part}" if current else part
            directories.add(current)
    return directories


def has_tests(lower_paths: Sequence[str]) -> bool:
    return any(
        "/tests/" in f"/{path}"
        or "/test/" in f"/{path}"
        or "__tests__/" in path
        or path.endswith(("_test.py", "_test.go", ".spec.ts", ".spec.tsx", ".test.ts", ".test.tsx"))
        or path.split("/")[-1].startswith("test_")
        for path in lower_paths
    )


def has_docker(lower_paths: Sequence[str]) -> bool:
    return any(
        path.split("/")[-1] == "dockerfile" or "docker-compose" in path for path in lower_paths
    )


def has_ci(lower_paths: Sequence[str]) -> bool:
    return any(
        path.startswith(".github/workflows/")
        or path == ".gitlab-ci.yml"
        or path.startswith(".circleci/")
        or path == ".travis.yml"
        for path in lower_paths
    )


def has_docs(lower_paths: Sequence[str], readme_text: str) -> bool:
    return bool(readme_text.strip()) or any(path.startswith("docs/") for path in lower_paths)


def has_deployment_config(lower_paths: Sequence[str]) -> bool:
    deployment_files = {
        "vercel.json",
        "render.yaml",
        "railway.json",
        "fly.toml",
        "procfile",
        "netlify.toml",
    }
    return any(
        path.split("/")[-1] in deployment_files
        or path.startswith(("infra/", "k8s/", "kubernetes/", "helm/"))
        or "docker-compose" in path
        for path in lower_paths
    )


def classify_readme_quality(readme_text: str) -> str:
    text = readme_text.strip()
    if not text:
        return "Missing"

    lower_text = text.lower()
    sections = sum(
        keyword in lower_text
        for keyword in (
            "installation",
            "setup",
            "usage",
            "features",
            "architecture",
            "test",
            "deploy",
        )
    )
    if len(text) >= 1800 and sections >= 3:
        return "Strong"
    if len(text) >= 700 and sections >= 2:
        return "Useful"
    return "Thin"


def infer_tech_stack(languages: Mapping[str, int], file_paths: Sequence[str]) -> list[str]:
    stack = [
        language
        for language, _bytes in sorted(
            languages.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]
    lower_paths = [path.lower() for path in file_paths]
    stack.extend(
        label
        for label, predicate in (
            ("Next.js", lambda: any(path.startswith("next.config.") for path in lower_paths)),
            ("React", lambda: any(path.endswith((".tsx", ".jsx")) for path in lower_paths)),
            (
                "Tailwind CSS",
                lambda: any(path.startswith("tailwind.config.") for path in lower_paths),
            ),
            (
                "Python packaging",
                lambda: any(
                    path.endswith(("pyproject.toml", "requirements.txt"))
                    for path in lower_paths
                ),
            ),
            ("Docker", lambda: has_docker(lower_paths)),
            (
                "GitHub Actions",
                lambda: any(path.startswith(".github/workflows/") for path in lower_paths),
            ),
            (
                "PostgreSQL",
                lambda: any("postgres" in path or "alembic" in path for path in lower_paths),
            ),
            ("Jupyter", lambda: any(path.endswith(".ipynb") for path in lower_paths)),
        )
        if predicate()
    )
    return unique_values(stack)[:12]


def classify_complexity(signals: GitHubDeterministicSignals) -> str:
    if signals.file_count >= 160 or signals.directory_count >= 35 or signals.language_count >= 5:
        return "High"
    if signals.file_count >= 40 or signals.directory_count >= 10 or signals.language_count >= 2:
        return "Moderate"
    return "Small"


def classify_commit_activity(last_commit_at: datetime | None) -> str:
    if last_commit_at is None:
        return "Unknown"

    days_old = (datetime.now(UTC) - last_commit_at.astimezone(UTC)).days
    if days_old <= 14:
        return "Active"
    if days_old <= 90:
        return "Recent"
    if days_old <= 365:
        return "Stale"
    return "Dormant"


def classify_deployment(signals: GitHubDeterministicSignals) -> str:
    if signals.has_deployment_config and signals.has_ci:
        return "Deployment and CI signals detected"
    if signals.has_deployment_config:
        return "Deployment configuration detected"
    if signals.has_docker:
        return "Containerization detected"
    return "No deployment signal detected"


def infer_architecture_signals(
    file_paths: Sequence[str],
    signals: GitHubDeterministicSignals,
) -> list[str]:
    lower_paths = [path.lower() for path in file_paths]
    architecture_signals: list[str] = []
    if any(path.startswith(("src/", "app/")) for path in lower_paths):
        architecture_signals.append("Source directory structure")
    if any(path.startswith(("api/", "server/", "backend/")) for path in lower_paths):
        architecture_signals.append("Backend/API layer")
    if any(path.startswith(("web/", "client/", "frontend/")) for path in lower_paths):
        architecture_signals.append("Frontend layer")
    if any("models" in path or "schema" in path or "migration" in path for path in lower_paths):
        architecture_signals.append("Data model or migration structure")
    if signals.has_tests:
        architecture_signals.append("Test organization")
    if signals.has_ci:
        architecture_signals.append("CI workflow")
    if signals.has_docker:
        architecture_signals.append("Containerized runtime")
    if signals.has_deployment_config:
        architecture_signals.append("Deployment configuration")
    return architecture_signals or ["Flat repository structure"]


def find_missing_documentation(
    readme_text: str,
    signals: GitHubDeterministicSignals,
) -> list[str]:
    if not readme_text.strip():
        return ["README", "Setup instructions", "Usage examples", "Testing instructions"]

    lower_text = readme_text.lower()
    missing: list[str] = []
    if not any(keyword in lower_text for keyword in ("install", "setup", "getting started")):
        missing.append("Setup instructions")
    if not any(keyword in lower_text for keyword in ("usage", "example", "demo")):
        missing.append("Usage examples")
    if signals.has_tests and not any(
        keyword in lower_text for keyword in ("test", "pytest", "jest", "vitest")
    ):
        missing.append("Testing instructions")
    if not any(keyword in lower_text for keyword in ("architecture", "design", "structure")):
        missing.append("Architecture notes")
    if signals.has_deployment_config and not any(
        keyword in lower_text for keyword in ("deploy", "docker", "production")
    ):
        missing.append("Deployment notes")
    return missing


def infer_best_fit_roles(
    languages: Mapping[str, int],
    file_paths: Sequence[str],
    tech_stack: Sequence[str],
) -> list[str]:
    lower_languages = {language.lower() for language in languages}
    lower_paths = [path.lower() for path in file_paths]
    lower_stack = {item.lower() for item in tech_stack}
    roles: list[str] = []
    path_tokens = {
        token
        for path in lower_paths
        for token in re.split(r"[^a-z0-9]+", path)
        if token
    }
    has_data_assets = any(
        path.endswith((".csv", ".xlsx", ".ipynb")) or "dashboard" in path
        for path in lower_paths
    )
    has_ml_signals = bool(
        {"ai", "ml", "model", "models", "notebook", "sklearn", "tensorflow", "torch"}
        & path_tokens
    )

    if has_data_assets or "jupyter notebook" in lower_languages or "jupyter" in lower_stack:
        roles.append("Data Science Intern")
    if has_ml_signals:
        roles.append("AI/ML Intern")
    if {"image", "images", "opencv", "vision", "cv2"} & path_tokens:
        roles.append("Image Processing Intern")
    if {"python", "go", "java", "c#", "rust"} & lower_languages or any(
        path.startswith(("api/", "server/", "backend/")) for path in lower_paths
    ):
        roles.append("Backend Intern")
    if {"typescript", "javascript", "go", "java", "python"} & lower_languages or {
        "react",
        "next.js",
    } & lower_stack:
        roles.append("Software Engineering Intern")
    if has_data_assets:
        roles.append("Business Analyst Intern")
    if {"process", "automation", "rpa", "optimization"} & path_tokens:
        roles.append("Process Improvement Intern")

    selected = [role for role in TARGET_ROLES if role in unique_values(roles)]
    return selected[:4] or ["Software Engineering Intern"]


def build_repository_summary(
    repository: FetchedGitHubRepository,
    signals: GitHubDeterministicSignals,
    analysis: GitHubRepositoryAnalysis,
) -> str:
    lines = [
        f"Repository: {repository.full_name}",
        f"Description: {repository.description or 'No description provided.'}",
        f"Stars: {repository.stars}",
        f"Languages: {', '.join(repository.languages) or 'Unknown'}",
        f"README quality: {analysis.readme_quality}",
        f"Complexity: {analysis.complexity}",
        f"Commit activity: {analysis.commit_activity}",
        f"Testing: {analysis.testing}",
        f"Deployment: {analysis.deployment}",
        (
            "Deterministic signals: "
            f"tests={signals.has_tests}, docker={signals.has_docker}, "
            f"ci={signals.has_ci}, readme_length={signals.readme_length}"
        ),
        f"Architecture signals: {', '.join(analysis.architecture_signals)}",
        f"Best-fit roles: {', '.join(analysis.best_fit_roles)}",
        f"Strengths: {', '.join(analysis.strengths)}",
        f"Weaknesses: {', '.join(analysis.weaknesses)}",
        f"Recommendations: {', '.join(analysis.recommendations)}",
    ]
    return "\n".join(lines)


def extract_llm_message_content(response_data: object) -> str | None:
    if not isinstance(response_data, dict):
        return None

    choices = response_data.get("choices")
    if isinstance(choices, list) and choices:
        first_choice = choices[0]
        if isinstance(first_choice, dict):
            message = first_choice.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"]

    output_text = response_data.get("output_text")
    if isinstance(output_text, str):
        return output_text

    if all(key in response_data for key in GitHubQualitativeFeedback.model_fields):
        return json.dumps(response_data)

    return None


def unique_values(values: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        stripped = value.strip()
        key = stripped.lower()
        if stripped and key not in seen:
            seen.add(key)
            unique.append(stripped)
    return unique
