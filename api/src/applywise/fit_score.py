from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.cloudflare_ai import CloudflareAIError, CloudflareWorkersAIClient
from applywise.embeddings import get_embedding_provider, safe_embed
from applywise.models import (
    FitAnalysis,
    GitHubRepository,
    GitHubRepositoryChunk,
    JobPost,
    Profile,
    Project,
    Resume,
    User,
)

FIT_SCORE_WEIGHTS = {
    "skill_score": 0.30,
    "project_relevance_score": 0.20,
    "experience_score": 0.15,
    "education_score": 0.10,
    "language_score": 0.10,
    "domain_score": 0.10,
    "profile_quality_score": 0.05,
}

embedding_provider = get_embedding_provider()


class FitExplanation(BaseModel):
    strong_matches: list[str] = Field(default_factory=list)
    weak_areas: list[str] = Field(default_factory=list)
    recommended_action: str = Field(min_length=1, max_length=600)

    @field_validator("strong_matches", "weak_areas")
    @classmethod
    def normalize_items(cls, values: list[str]) -> list[str]:
        return unique_values(values)

    @field_validator("recommended_action")
    @classmethod
    def strip_action(cls, value: str) -> str:
        return value.strip() or "Improve the lowest scoring areas before applying."


class FitComponentScores(BaseModel):
    skill_score: float
    project_relevance_score: float
    experience_score: float
    education_score: float
    language_score: float
    domain_score: float
    profile_quality_score: float

    def weighted_total(self) -> float:
        total = sum(getattr(self, field) * weight for field, weight in FIT_SCORE_WEIGHTS.items())
        return rounded_score(total)


class FitScoreResult(BaseModel):
    components: FitComponentScores
    total_score: float
    explanation: FitExplanation
    signals: dict[str, Any]


class FitExplanationProvider(Protocol):
    def explain_fit_json(self, payload: dict[str, Any]) -> str:
        pass


class FitExplanationError(RuntimeError):
    pass


class LocalFitExplanationProvider:
    def explain_fit_json(self, payload: dict[str, Any]) -> str:
        components = payload.get("components", {})
        total_score = float(payload.get("total_score", 0))
        matched_skills = payload.get("signals", {}).get("matched_skills", [])
        missing_skills = payload.get("signals", {}).get("missing_required_skills", [])

        strong_matches = []
        if matched_skills:
            strong_matches.append(
                f"Skill score {components.get('skill_score', 0):.1f}: matched "
                f"{', '.join(matched_skills[:5])}."
            )
        if components.get("project_relevance_score", 0) >= 70:
            strong_matches.append(
                f"Project relevance {components.get('project_relevance_score', 0):.1f}: "
                "portfolio evidence is aligned with the job domain."
            )
        if components.get("language_score", 0) >= 80:
            strong_matches.append(
                f"Language score {components.get('language_score', 0):.1f}: language profile "
                "meets the role signal."
            )

        weak_areas = []
        if missing_skills:
            weak_areas.append(
                f"Skill gaps remain: {', '.join(missing_skills[:5])}."
            )
        low_components = [
            (label, float(components.get(field, 0)))
            for field, label in (
                ("project_relevance_score", "project relevance"),
                ("experience_score", "experience"),
                ("education_score", "education"),
                ("domain_score", "domain"),
                ("profile_quality_score", "profile quality"),
            )
            if float(components.get(field, 0)) < 60
        ]
        for label, value in low_components[:3]:
            weak_areas.append(f"{label.title()} is {value:.1f}, below the target range.")

        if total_score >= 75:
            action = (
                f"Overall fit is {total_score:.1f}. Apply, then tailor examples around the "
                "highest-scoring skills and projects."
            )
        elif total_score >= 55:
            action = (
                f"Overall fit is {total_score:.1f}. Apply after improving the weakest one or "
                "two components and making the matched evidence explicit."
            )
        else:
            action = (
                f"Overall fit is {total_score:.1f}. Treat this as a stretch role and close the "
                "largest skill/profile gaps before prioritizing it."
            )

        return FitExplanation(
            strong_matches=strong_matches or ["No dominant strong match was detected yet."],
            weak_areas=weak_areas or ["No major weak area was detected from current data."],
            recommended_action=action,
        ).model_dump_json()


class OpenAICompatibleFitExplanationProvider:
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

    def explain_fit_json(self, payload: dict[str, Any]) -> str:
        request_payload = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You explain an internship fit analysis as JSON only. Return exactly "
                        "strong_matches, weak_areas, and recommended_action. Reference the "
                        "provided computed numbers. Do not change, invent, or recalculate scores."
                    ),
                },
                {"role": "user", "content": json.dumps(payload, separators=(",", ":"))},
            ],
        }
        request = Request(
            self.api_url,
            data=json.dumps(request_payload).encode("utf-8"),
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
            raise FitExplanationError("LLM fit explanation request failed.") from exc

        content = extract_llm_message_content(response_data)
        if content is None:
            raise FitExplanationError("LLM fit explanation response was not understood.")
        return content


class CloudflareFitExplanationProvider:
    def __init__(self, client: CloudflareWorkersAIClient) -> None:
        self.client = client

    def explain_fit_json(self, payload: dict[str, Any]) -> str:
        try:
            return self.client.generate_json(
                system_prompt=(
                    "Explain the internship fit analysis using the requested JSON schema. "
                    "Reference the supplied deterministic component scores and total. Never "
                    "change, recalculate, or invent a score. Keep recommendations concrete."
                ),
                user_content=json.dumps(payload, separators=(",", ":")),
                json_schema=FitExplanation.model_json_schema(),
                max_tokens=1400,
            )
        except CloudflareAIError as exc:
            raise FitExplanationError("Cloudflare fit explanation failed.") from exc


@dataclass(frozen=True)
class UserFitContext:
    profile: Profile | None
    resumes: list[Resume]
    projects: list[Project]
    repositories: list[GitHubRepository]
    repository_chunks: list[GitHubRepositoryChunk]


def compute_and_store_fit_analysis(
    session: Session,
    *,
    user: User,
    job_post: JobPost,
    explanation_provider: FitExplanationProvider | None = None,
) -> FitAnalysis:
    context = load_user_fit_context(session, user)
    result = score_fit(job_post, context, explanation_provider=explanation_provider)
    fit_analysis = latest_fit_analysis(session, user=user, job_post=job_post)

    values = {
        "skill_score": result.components.skill_score,
        "project_relevance_score": result.components.project_relevance_score,
        "experience_score": result.components.experience_score,
        "education_score": result.components.education_score,
        "language_score": result.components.language_score,
        "domain_score": result.components.domain_score,
        "profile_quality_score": result.components.profile_quality_score,
        "total_score": result.total_score,
        "breakdown": {
            "weights": FIT_SCORE_WEIGHTS,
            "components": result.components.model_dump(),
            "signals": result.signals,
            "explanation": result.explanation.model_dump(),
        },
    }

    if fit_analysis is None:
        fit_analysis = FitAnalysis(user_id=user.id, job_post_id=job_post.id, **values)
        session.add(fit_analysis)
    else:
        for key, value in values.items():
            setattr(fit_analysis, key, value)

    session.flush()
    return fit_analysis


def score_fit(
    job_post: JobPost,
    context: UserFitContext,
    *,
    explanation_provider: FitExplanationProvider | None = None,
) -> FitScoreResult:
    signals = build_fit_signals(job_post, context)
    components = FitComponentScores(
        skill_score=score_skill_match(signals),
        project_relevance_score=score_project_relevance(signals),
        experience_score=score_experience(job_post, context),
        education_score=score_education(job_post, context),
        language_score=score_language(job_post, context),
        domain_score=score_domain(job_post, context, signals),
        profile_quality_score=score_profile_quality(context),
    )
    total_score = components.weighted_total()
    explanation = explain_fit(
        components=components,
        total_score=total_score,
        signals=signals,
        provider=explanation_provider,
    )
    return FitScoreResult(
        components=components,
        total_score=total_score,
        explanation=explanation,
        signals=signals,
    )


def load_user_fit_context(session: Session, user: User) -> UserFitContext:
    resumes = session.scalars(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc())
    ).all()
    projects = session.scalars(
        select(Project).where(Project.user_id == user.id).order_by(Project.created_at.desc())
    ).all()
    repositories = session.scalars(
        select(GitHubRepository)
        .where(GitHubRepository.user_id == user.id)
        .order_by(GitHubRepository.updated_at.desc())
    ).all()
    chunks = session.scalars(
        select(GitHubRepositoryChunk)
        .join(GitHubRepository)
        .where(GitHubRepository.user_id == user.id)
    ).all()
    return UserFitContext(
        profile=user.profile,
        resumes=list(resumes),
        projects=list(projects),
        repositories=list(repositories),
        repository_chunks=list(chunks),
    )


def latest_fit_analysis(session: Session, *, user: User, job_post: JobPost) -> FitAnalysis | None:
    return session.scalars(
        select(FitAnalysis)
        .where(FitAnalysis.user_id == user.id, FitAnalysis.job_post_id == job_post.id)
        .order_by(FitAnalysis.updated_at.desc(), FitAnalysis.created_at.desc())
        .limit(1)
    ).first()


def build_fit_signals(job_post: JobPost, context: UserFitContext) -> dict[str, Any]:
    job_required_skills = normalize_tags(job_post.required_skills or [])
    job_nice_skills = normalize_tags(job_post.nice_to_have_skills or [])
    job_skill_keys = {skill_key(skill) for skill in [*job_required_skills, *job_nice_skills]}
    user_skills = collect_user_skills(context)
    user_skill_keys = {skill_key(skill) for skill in user_skills}
    matched_required = [
        skill for skill in job_required_skills if skill_key(skill) in user_skill_keys
    ]
    matched_nice = [skill for skill in job_nice_skills if skill_key(skill) in user_skill_keys]
    missing_required = [
        skill for skill in job_required_skills if skill_key(skill) not in user_skill_keys
    ]
    job_embedding = ensure_embedding(
        job_post.description,
        job_post.embedding,
        job_post.embedding_model,
    )
    user_profile_text = build_user_profile_text(context)
    profile_similarity = cosine_similarity(
        job_embedding,
        safe_embed(embedding_provider, user_profile_text) if user_profile_text else None,
    )
    project_scores = project_relevance_candidates(job_post, context, job_skill_keys, job_embedding)

    return {
        "job_required_skills": job_required_skills,
        "job_nice_to_have_skills": job_nice_skills,
        "user_skills": user_skills,
        "matched_skills": unique_values([*matched_required, *matched_nice]),
        "matched_required_skills": matched_required,
        "matched_nice_to_have_skills": matched_nice,
        "missing_required_skills": missing_required,
        "profile_embedding_similarity": rounded_score(profile_similarity * 100),
        "project_relevance_candidates": project_scores,
        "best_project_relevance": max(
            [candidate["score"] for candidate in project_scores],
            default=0.0,
        ),
    }


def collect_user_skills(context: UserFitContext) -> list[str]:
    skills: list[str] = []
    if context.profile:
        skills.extend(context.profile.skills or [])
        skills.extend(context.profile.target_roles or [])

    for resume in context.resumes:
        parsed_data = resume.parsed_data or {}
        for value in parsed_data.get("skills", []):
            if isinstance(value, str):
                skills.append(value)

    for project in context.projects:
        skills.extend(project.skills or [])

    for repository in context.repositories:
        skills.extend(repository.languages.keys())
        analysis_data = repository.analysis_data or {}
        for value in analysis_data.get("tech_stack", []):
            if isinstance(value, str):
                skills.append(value)

    return normalize_tags(skills)


def build_user_profile_text(context: UserFitContext) -> str:
    sections: list[str] = []
    if context.profile:
        sections.extend(
            value
            for value in (
                context.profile.headline,
                context.profile.bio,
                context.profile.education_level,
                context.profile.experience_level,
                " ".join(context.profile.skills or []),
                " ".join(context.profile.target_roles or []),
            )
            if value
        )
    sections.extend(resume.content_text for resume in context.resumes if resume.content_text)
    sections.extend(project_text(project) for project in context.projects)
    sections.extend(
        repository.summary_text or repository.description or ""
        for repository in context.repositories
    )
    return "\n".join(section for section in sections if section)


def project_relevance_candidates(
    job_post: JobPost,
    context: UserFitContext,
    job_skill_keys: set[str],
    job_embedding: list[float] | None,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for project in context.projects:
        text = project_text(project)
        project_skill_keys = {skill_key(skill) for skill in project.skills or []}
        overlap_score = overlap_percentage(job_skill_keys, project_skill_keys)
        semantic_score = cosine_similarity(
            job_embedding,
            safe_embed(embedding_provider, text),
        ) * 100
        score = rounded_score((0.6 * overlap_score) + (0.4 * semantic_score))
        candidates.append(
            {
                "type": "project",
                "name": project.name,
                "score": score,
                "skill_overlap_score": rounded_score(overlap_score),
                "embedding_similarity_score": rounded_score(semantic_score),
            }
        )

    for repository in context.repositories:
        text = (
            repository.summary_text
            or repository.description
            or repository.readme_text
            or repository.full_name
        )
        repo_skill_keys = {skill_key(skill) for skill in repository.languages.keys()}
        analysis_data = repository.analysis_data or {}
        repo_skill_keys.update(
            skill_key(skill)
            for skill in analysis_data.get("tech_stack", [])
            if isinstance(skill, str)
        )
        overlap_score = overlap_percentage(job_skill_keys, repo_skill_keys)
        semantic_score = max_repository_similarity(
            repository,
            context.repository_chunks,
            job_embedding,
            text,
        )
        score = rounded_score((0.6 * overlap_score) + (0.4 * semantic_score))
        candidates.append(
            {
                "type": "github_repository",
                "name": repository.full_name,
                "score": score,
                "skill_overlap_score": rounded_score(overlap_score),
                "embedding_similarity_score": rounded_score(semantic_score),
            }
        )

    return sorted(candidates, key=lambda candidate: candidate["score"], reverse=True)


def score_skill_match(signals: dict[str, Any]) -> float:
    required_skills = signals["job_required_skills"]
    nice_skills = signals["job_nice_to_have_skills"]
    required_overlap = percentage(len(signals["matched_required_skills"]), len(required_skills))
    nice_overlap = percentage(len(signals["matched_nice_to_have_skills"]), len(nice_skills))
    if nice_skills:
        overlap_score = (0.85 * required_overlap) + (0.15 * nice_overlap)
    else:
        overlap_score = required_overlap
    semantic_score = float(signals["profile_embedding_similarity"])
    return rounded_score((0.75 * overlap_score) + (0.25 * semantic_score))


def score_project_relevance(signals: dict[str, Any]) -> float:
    return rounded_score(float(signals["best_project_relevance"]))


def score_experience(job_post: JobPost, context: UserFitContext) -> float:
    experience_text = " ".join(
        value
        for value in [
            context.profile.experience_level if context.profile else None,
            *[
                " ".join(
                    item
                    for item in resume.parsed_data.get("experience", [])
                    if isinstance(item, str)
                )
                for resume in context.resumes
            ],
        ]
        if value
    ).lower()
    seniority = (job_post.seniority_level or "").lower()

    if "intern" in seniority:
        if any(term in experience_text for term in ("intern", "project", "student", "entry")):
            return 90.0
        return 75.0 if experience_text else 55.0
    if "junior" in seniority or "entry" in seniority:
        return 80.0 if experience_text else 45.0
    if "senior" in seniority:
        has_senior_signal = any(
            term in experience_text for term in ("senior", "lead", "years")
        )
        return 70.0 if has_senior_signal else 25.0
    return 65.0 if experience_text else 40.0


def score_education(job_post: JobPost, context: UserFitContext) -> float:
    education_text = " ".join(
        value
        for value in [
            context.profile.education_level if context.profile else None,
            *[
                " ".join(
                    item
                    for item in resume.parsed_data.get("education", [])
                    if isinstance(item, str)
                )
                for resume in context.resumes
            ],
        ]
        if value
    ).lower()
    job_text = f"{job_post.description} {job_post.domain or ''}".lower()
    if not education_text:
        return 35.0
    if any(term in education_text for term in ("computer", "software", "data", "ai", "machine")):
        return 95.0
    if any(term in education_text for term in ("engineering", "bachelor", "bs", "msc", "master")):
        return 80.0
    if any(term in job_text for term in ("student", "degree", "engineering")):
        return 65.0
    return 70.0


def score_language(job_post: JobPost, context: UserFitContext) -> float:
    requirement = (job_post.english_requirement or "").lower()
    languages = context.profile.languages if context.profile else []
    english_level = ""
    for language in languages or []:
        name = str(language.get("name", "")).lower()
        if "english" in name:
            english_level = str(language.get("level", "")).lower()
            break

    if "not specified" in requirement or not requirement:
        return 80.0 if english_level else 60.0
    if not english_level:
        return 30.0
    if any(term in english_level for term in ("native", "fluent", "c1", "c2", "advanced")):
        return 100.0
    if any(term in english_level for term in ("b2", "upper", "working", "professional")):
        return 85.0
    if any(term in english_level for term in ("b1", "intermediate")):
        return 65.0
    return 50.0


def score_domain(job_post: JobPost, context: UserFitContext, signals: dict[str, Any]) -> float:
    domain = (job_post.domain or "").lower()
    target_roles = [
        role.lower() for role in (context.profile.target_roles if context.profile else [])
    ]
    user_text = build_user_profile_text(context).lower()
    domain_terms = domain_tokens(domain)
    if not domain_terms:
        return rounded_score(float(signals["profile_embedding_similarity"]))
    target_match = any(any(term in role for term in domain_terms) for role in target_roles)
    text_match = any(term in user_text for term in domain_terms)
    semantic_score = float(signals["profile_embedding_similarity"])
    overlap_score = 100.0 if target_match else 75.0 if text_match else 30.0
    return rounded_score((0.6 * overlap_score) + (0.4 * semantic_score))


def score_profile_quality(context: UserFitContext) -> float:
    score = 0.0
    profile = context.profile
    if profile:
        score += 15 if profile.education_level else 0
        score += 20 if profile.skills else 0
        score += 15 if profile.target_roles else 0
        score += 10 if profile.languages else 0
        score += 10 if profile.experience_level else 0
        score += 10 if profile.github_url else 0
    score += 10 if context.projects else 0
    score += 10 if context.resumes else 0
    score += 10 if context.repositories else 0
    return rounded_score(min(score, 100.0))


def explain_fit(
    *,
    components: FitComponentScores,
    total_score: float,
    signals: dict[str, Any],
    provider: FitExplanationProvider | None = None,
) -> FitExplanation:
    payload = {
        "components": components.model_dump(),
        "total_score": total_score,
        "signals": signals,
    }
    try:
        explanation_provider = provider or get_fit_explanation_provider()
    except FitExplanationError:
        if provider is not None:
            raise
        return FitExplanation.model_validate_json(
            LocalFitExplanationProvider().explain_fit_json(payload)
        )

    last_error: Exception | None = None
    for _attempt in range(2):
        try:
            return FitExplanation.model_validate_json(
                explanation_provider.explain_fit_json(payload)
            )
        except (FitExplanationError, ValidationError, ValueError) as exc:
            last_error = exc

    if provider is not None:
        raise FitExplanationError("Fit explanation provider returned invalid JSON.") from last_error
    return FitExplanation.model_validate_json(
        LocalFitExplanationProvider().explain_fit_json(payload)
    )


def get_fit_explanation_provider() -> FitExplanationProvider:
    provider = os.environ.get("LLM_PROVIDER", "local").strip().lower()
    if provider in {"", "local", "heuristic"}:
        return LocalFitExplanationProvider()
    if provider == "cloudflare":
        try:
            return CloudflareFitExplanationProvider(
                CloudflareWorkersAIClient.from_environment()
            )
        except CloudflareAIError as exc:
            raise FitExplanationError("Cloudflare AI is not fully configured.") from exc
    if provider in {"openai", "openai-compatible"}:
        api_url = os.environ.get("LLM_API_URL", "").strip()
        api_key = os.environ.get("LLM_API_KEY", "").strip()
        model = os.environ.get("LLM_MODEL", "").strip()
        if not api_url or not api_key or not model:
            raise FitExplanationError("LLM provider is not fully configured.")
        return OpenAICompatibleFitExplanationProvider(
            api_url=api_url,
            api_key=api_key,
            model=model,
            timeout_seconds=float(os.environ.get("LLM_TIMEOUT_SECONDS", "30")),
        )
    raise FitExplanationError(f"Unsupported LLM provider: {provider}.")


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
    if all(key in response_data for key in FitExplanation.model_fields):
        return json.dumps(response_data)
    return None


def max_repository_similarity(
    repository: GitHubRepository,
    chunks: list[GitHubRepositoryChunk],
    job_embedding: list[float] | None,
    fallback_text: str,
) -> float:
    repository_chunks = [chunk for chunk in chunks if chunk.repository_id == repository.id]
    similarities = [
        cosine_similarity(
            job_embedding,
            ensure_embedding(chunk.content, chunk.embedding, chunk.embedding_model),
        )
        * 100
        for chunk in repository_chunks
    ]
    if not similarities:
        similarities.append(
            cosine_similarity(
                job_embedding,
                safe_embed(embedding_provider, fallback_text),
            )
            * 100
        )
    return rounded_score(max(similarities, default=0.0))


def project_text(project: Project) -> str:
    return "\n".join(
        value
        for value in [
            project.name,
            project.description or "",
            " ".join(project.skills or []),
        ]
        if value
    )


def ensure_embedding(
    text: str,
    embedding: list[float] | None,
    embedding_model: str | None = None,
) -> list[float] | None:
    if embedding is not None and embedding_model == embedding_provider.model_name:
        return embedding
    return safe_embed(embedding_provider, text)


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right:
        return 0.0
    length = min(len(left), len(right))
    if length == 0:
        return 0.0
    dot = sum(left[index] * right[index] for index in range(length))
    left_mag = math.sqrt(sum(item * item for item in left[:length]))
    right_mag = math.sqrt(sum(item * item for item in right[:length]))
    if left_mag == 0 or right_mag == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_mag * right_mag)))


def percentage(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return (numerator / denominator) * 100


def overlap_percentage(expected: set[str], actual: set[str]) -> float:
    if not expected:
        return 0.0
    return percentage(len(expected & actual), len(expected))


def rounded_score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def skill_key(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.]+", "", value.lower().replace("large language model", "llm"))


def normalize_tags(values: list[str]) -> list[str]:
    return unique_values([value for value in values if isinstance(value, str)])


def unique_values(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        stripped = re.sub(r"\s+", " ", value).strip(" .:-")
        key = stripped.lower()
        if stripped and key not in seen:
            seen.add(key)
            unique.append(stripped)
    return unique


def domain_tokens(domain: str) -> list[str]:
    if "ai" in domain or "ml" in domain or "machine" in domain:
        return ["ai", "ml", "machine learning", "llm", "rag"]
    if "backend" in domain:
        return ["backend", "api", "fastapi", "postgresql"]
    if "data" in domain or "analytics" in domain:
        return ["data", "analytics", "sql", "dashboard"]
    if "image" in domain or "vision" in domain:
        return ["image", "vision", "opencv"]
    if "process" in domain:
        return ["process", "workflow", "operations"]
    return [token for token in re.split(r"[^a-z0-9]+", domain) if token]
