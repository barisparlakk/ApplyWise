from __future__ import annotations

import json
import os
from typing import Any, Protocol

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.cloudflare_ai import CloudflareAIError, CloudflareWorkersAIClient
from applywise.environment import boolean_environment
from applywise.models import CompanyProfile, GitHubRepository, JobPost, Project, User


class ProjectEmphasis(BaseModel):
    name: str = Field(min_length=1, max_length=380)
    reason: str = Field(min_length=1, max_length=600)
    talking_points: list[str] = Field(min_length=1, max_length=4)

    @field_validator("name", "reason")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("talking_points")
    @classmethod
    def normalize_talking_points(cls, values: list[str]) -> list[str]:
        return unique_text(values, limit=4, item_limit=500)


class CompanyProfileContent(BaseModel):
    what_company_does: str = Field(min_length=1, max_length=1200)
    likely_interview_angles: list[str] = Field(min_length=2, max_length=8)
    projects_to_emphasize: list[ProjectEmphasis] = Field(default_factory=list, max_length=4)
    smart_questions: list[str] = Field(min_length=3, max_length=8)

    @field_validator("what_company_does")
    @classmethod
    def normalize_summary(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("likely_interview_angles")
    @classmethod
    def normalize_angles(cls, values: list[str]) -> list[str]:
        return unique_text(values, limit=8, item_limit=600)

    @field_validator("smart_questions")
    @classmethod
    def normalize_questions(cls, values: list[str]) -> list[str]:
        questions = unique_text(values, limit=8, item_limit=600)
        return [question if question.endswith("?") else f"{question}?" for question in questions]


class CompanyProfileProvider(Protocol):
    def generate_company_profile_json(self, context: dict[str, Any]) -> str: ...


class CompanyProfileGenerationError(RuntimeError):
    pass


class LocalCompanyProfileProvider:
    def generate_company_profile_json(self, context: dict[str, Any]) -> str:
        return build_local_content(context).model_dump_json()


class CloudflareCompanyProfileProvider:
    def __init__(self, client: CloudflareWorkersAIClient) -> None:
        self.client = client

    def generate_company_profile_json(self, context: dict[str, Any]) -> str:
        try:
            return self.client.generate_json(
                system_prompt=(
                    "Create company-specific internship preparation using only the supplied job "
                    "post and candidate evidence. Do not use or invent outside company facts. "
                    "Select project names exactly as provided. Explain likely interview angles, "
                    "which real projects to emphasize, and thoughtful questions. Use the main "
                    "language of the job post and return only the requested JSON schema."
                ),
                user_content=json.dumps(context, separators=(",", ":"), ensure_ascii=False),
                json_schema=CompanyProfileContent.model_json_schema(),
                max_tokens=2600,
                temperature=0.2,
            )
        except CloudflareAIError as exc:
            raise CompanyProfileGenerationError(
                "Cloudflare company preparation failed."
            ) from exc


def generate_and_store_company_profile(
    session: Session,
    *,
    user: User,
    job_post: JobPost,
    provider: CompanyProfileProvider | None = None,
) -> CompanyProfile:
    context = build_company_context(session, user=user, job_post=job_post)
    fallback = build_local_content(context)
    content = generate_company_profile_content(
        context,
        provider=provider,
        fallback=fallback,
    )
    profile = session.scalar(
        select(CompanyProfile).where(
            CompanyProfile.user_id == user.id,
            CompanyProfile.job_post_id == job_post.id,
        )
    )
    values = {
        "what_company_does": content.what_company_does,
        "likely_interview_angles": content.likely_interview_angles,
        "projects_to_emphasize": [
            project.model_dump() for project in content.projects_to_emphasize
        ],
        "smart_questions": content.smart_questions,
    }
    if profile is None:
        profile = CompanyProfile(
            user_id=user.id,
            job_post_id=job_post.id,
            **values,
        )
        session.add(profile)
    else:
        for key, value in values.items():
            setattr(profile, key, value)
    session.flush()
    return profile


def generate_company_profile_content(
    context: dict[str, Any],
    *,
    provider: CompanyProfileProvider | None,
    fallback: CompanyProfileContent,
) -> CompanyProfileContent:
    try:
        selected_provider = provider or get_company_profile_provider()
    except CompanyProfileGenerationError:
        if provider is not None or not boolean_environment("AI_ALLOW_LOCAL_FALLBACK", True):
            raise
        return fallback

    last_error: Exception | None = None
    for _attempt in range(2):
        try:
            generated = CompanyProfileContent.model_validate_json(
                selected_provider.generate_company_profile_json(context)
            )
            return sanitize_generated_content(generated, context=context, fallback=fallback)
        except (CompanyProfileGenerationError, ValidationError, ValueError) as exc:
            last_error = exc
            if isinstance(exc, CompanyProfileGenerationError):
                break

    if provider is not None or not boolean_environment("AI_ALLOW_LOCAL_FALLBACK", True):
        raise CompanyProfileGenerationError(
            "Company preparation provider returned invalid output."
        ) from last_error
    return fallback


def get_company_profile_provider() -> CompanyProfileProvider:
    provider = os.environ.get("LLM_PROVIDER", "local").strip().lower()
    if provider in {"", "local", "heuristic"}:
        return LocalCompanyProfileProvider()
    if provider == "cloudflare":
        try:
            return CloudflareCompanyProfileProvider(
                CloudflareWorkersAIClient.from_environment()
            )
        except CloudflareAIError as exc:
            raise CompanyProfileGenerationError(
                "Cloudflare AI is not fully configured."
            ) from exc
    raise CompanyProfileGenerationError(f"Unsupported company profile provider: {provider}.")


def build_company_context(
    session: Session,
    *,
    user: User,
    job_post: JobPost,
) -> dict[str, Any]:
    projects = session.scalars(
        select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc())
    ).all()
    repositories = session.scalars(
        select(GitHubRepository)
        .where(GitHubRepository.user_id == user.id)
        .order_by(GitHubRepository.updated_at.desc())
    ).all()
    evidence = [
        {
            "name": project.name,
            "kind": "project",
            "description": project.description or "",
            "skills": project.skills or [],
        }
        for project in projects
    ]
    evidence.extend(
        {
            "name": repository.full_name,
            "kind": "repository",
            "description": repository.summary_text or repository.description or "",
            "skills": [
                *repository.languages.keys(),
                *[
                    str(skill)
                    for skill in (repository.analysis_data or {}).get("tech_stack", [])
                ],
            ],
        }
        for repository in repositories
    )
    return {
        "job": {
            "company": job_post.company_name,
            "role": job_post.title,
            "domain": job_post.domain,
            "required_skills": job_post.required_skills or [],
            "nice_to_have_skills": job_post.nice_to_have_skills or [],
            "responsibilities": job_post.responsibilities or [],
            "hidden_expectations": job_post.hidden_expectations or [],
            "business_expectations": job_post.business_expectations or [],
            "communication_expectations": job_post.communication_expectations or [],
            "description_excerpt": job_post.description[:5000],
        },
        "candidate": {
            "education": user.profile.education_level if user.profile else None,
            "skills": user.profile.skills if user.profile else [],
            "target_roles": user.profile.target_roles if user.profile else [],
            "evidence": evidence[:20],
        },
    }


def build_local_content(context: dict[str, Any]) -> CompanyProfileContent:
    job = context["job"]
    candidate = context["candidate"]
    company = str(job["company"])
    role = str(job["role"])
    responsibilities = [str(value) for value in job["responsibilities"]]
    required_skills = [str(value) for value in job["required_skills"]]
    hidden_expectations = [str(value) for value in job["hidden_expectations"]]
    domain = str(job.get("domain") or role)
    responsibility = responsibilities[0] if responsibilities else f"contribute to {domain} work"
    summary = (
        f"Based on the supplied job post, {company} is hiring a {role} to {responsibility}. "
        f"The role is positioned in {domain} and emphasizes the listed responsibilities and "
        "candidate expectations."
    )
    angles = [
        *[f"Applied {skill} decisions and tradeoffs" for skill in required_skills[:3]],
        *[f"Evidence for this responsibility: {item}" for item in responsibilities[:2]],
        *[f"Hidden expectation: {item}" for item in hidden_expectations[:2]],
    ]
    if len(angles) < 2:
        angles.extend([f"Motivation for the {role} role", "Clear project communication"])

    evidence = [item for item in candidate["evidence"] if isinstance(item, dict)]
    ranked_evidence = sorted(
        evidence,
        key=lambda item: evidence_overlap(item, required_skills),
        reverse=True,
    )
    projects = [
        ProjectEmphasis(
            name=str(item["name"]),
            reason=(
                f"This evidence overlaps with {role} through "
                f"{project_overlap_label(item, required_skills)}."
            ),
            talking_points=[
                "State the problem, your ownership, and the result without overstating impact.",
                "Explain one technical decision, tradeoff, and validation step.",
            ],
        )
        for item in ranked_evidence[:3]
    ]
    questions = [
        f"How will success for the {role} be measured during the internship?",
        f"Which {domain} problem would the intern likely own first?",
        "How does the team review technical decisions and give interns feedback?",
        "What distinguishes interns who earn broader ownership on this team?",
    ]
    return CompanyProfileContent(
        what_company_does=summary,
        likely_interview_angles=angles[:8],
        projects_to_emphasize=projects,
        smart_questions=questions,
    )


def sanitize_generated_content(
    content: CompanyProfileContent,
    *,
    context: dict[str, Any],
    fallback: CompanyProfileContent,
) -> CompanyProfileContent:
    evidence = context["candidate"]["evidence"]
    allowed_names = {
        str(item["name"]).casefold(): str(item["name"])
        for item in evidence
        if isinstance(item, dict) and item.get("name")
    }
    projects = []
    for project in content.projects_to_emphasize:
        canonical_name = allowed_names.get(project.name.casefold())
        if canonical_name is not None:
            projects.append(project.model_copy(update={"name": canonical_name}))
    return content.model_copy(
        update={
            "projects_to_emphasize": projects or fallback.projects_to_emphasize,
        }
    )


def matched_evidence_skills(item: dict[str, Any], required_skills: list[str]) -> list[str]:
    item_skills = {str(skill).casefold() for skill in item.get("skills", [])}
    return [skill for skill in required_skills if skill.casefold() in item_skills]


def evidence_overlap(item: dict[str, Any], required_skills: list[str]) -> int:
    return len(matched_evidence_skills(item, required_skills))


def project_overlap_label(item: dict[str, Any], required_skills: list[str]) -> str:
    return ", ".join(matched_evidence_skills(item, required_skills)) or "its delivery scope"


def unique_text(values: list[str], *, limit: int, item_limit: int) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for raw_value in values:
        value = " ".join(raw_value.split())[:item_limit]
        key = value.casefold()
        if value and key not in seen:
            seen.add(key)
            unique.append(value)
    return unique[:limit]
