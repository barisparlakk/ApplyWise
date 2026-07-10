from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import Profile, Project, Skill, User
from applywise.validation import bounded_text_values, optional_http_url

TARGET_ROLE_OPTIONS = (
    "Data Science Intern",
    "AI/ML Intern",
    "Backend Intern",
    "Image Processing Intern",
    "Software Engineering Intern",
    "Business Analyst Intern",
    "Process Improvement Intern",
)

router = APIRouter(prefix="/profile", tags=["profile"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


class LanguagePayload(BaseModel):
    name: str = Field(max_length=80)
    level: str = Field(max_length=80)

    @field_validator("name", "level")
    @classmethod
    def strip_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Language fields cannot be empty.")
        return stripped


class ProjectPayload(BaseModel):
    name: str = Field(max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    url: str | None = Field(default=None, max_length=2048)
    skills: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Project name is required.")
        return stripped

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, value: list[str]) -> list[str]:
        return normalize_tags(value)

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        return optional_http_url(value)


class ProjectResponse(ProjectPayload):
    id: uuid.UUID


class ProfilePayload(BaseModel):
    education: str | None = Field(default=None, max_length=120)
    github_url: str | None = Field(default=None, max_length=2048)
    target_roles: list[str] = Field(default_factory=list, max_length=len(TARGET_ROLE_OPTIONS))
    preferred_location: str | None = Field(default=None, max_length=255)
    internship_type: str | None = Field(default=None, max_length=120)
    languages: list[LanguagePayload] = Field(default_factory=list, max_length=20)
    experience_level: str | None = Field(default=None, max_length=120)

    @field_validator(
        "education",
        "github_url",
        "preferred_location",
        "internship_type",
        "experience_level",
    )
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("target_roles")
    @classmethod
    def validate_target_roles(cls, value: list[str]) -> list[str]:
        roles = normalize_tags(value)
        invalid_roles = [role for role in roles if role not in TARGET_ROLE_OPTIONS]
        if invalid_roles:
            raise ValueError(f"Unsupported target role: {invalid_roles[0]}")
        return roles

    @field_validator("github_url")
    @classmethod
    def validate_github_url(cls, value: str | None) -> str | None:
        return optional_http_url(value)


class SkillPayload(BaseModel):
    skills: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, value: list[str]) -> list[str]:
        return normalize_tags(value)


class ProjectsPayload(BaseModel):
    projects: list[ProjectPayload] = Field(default_factory=list, max_length=25)


class ProfileResponse(ProfilePayload):
    id: uuid.UUID | None
    skills: list[str]


class ProfileSnapshot(BaseModel):
    profile: ProfileResponse
    projects: list[ProjectResponse]
    target_role_options: list[str]


def normalize_tags(values: list[str]) -> list[str]:
    values = bounded_text_values(values, max_items=100, max_item_length=120)
    seen: set[str] = set()
    tags: list[str] = []
    for raw_value in values:
        value = raw_value.strip()
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            tags.append(value)
    return tags


def empty_profile_response() -> ProfileResponse:
    return ProfileResponse(
        id=None,
        education=None,
        github_url=None,
        target_roles=[],
        preferred_location=None,
        internship_type=None,
        languages=[],
        experience_level=None,
        skills=[],
    )


def profile_to_response(profile: Profile | None) -> ProfileResponse:
    if profile is None:
        return empty_profile_response()

    languages: list[dict[str, Any]] = profile.languages or []
    return ProfileResponse(
        id=profile.id,
        education=profile.education_level,
        github_url=profile.github_url,
        target_roles=profile.target_roles or [],
        preferred_location=profile.preferred_location,
        internship_type=profile.internship_type,
        languages=[LanguagePayload.model_validate(language) for language in languages],
        experience_level=profile.experience_level,
        skills=profile.skills or [],
    )


def project_to_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        url=project.url,
        skills=project.skills or [],
    )


def get_or_create_profile(session: Session, user: User) -> Profile:
    profile = user.profile
    if profile is None:
        profile = Profile(
            user_id=user.id,
            target_roles=[],
            skills=[],
            languages=[],
        )
        session.add(profile)
        session.flush()
    return profile


def ensure_skills(session: Session, skills: list[str]) -> None:
    for skill_name in skills:
        existing = session.scalars(select(Skill).where(Skill.name == skill_name)).first()
        if existing is None:
            session.add(Skill(name=skill_name, category="profile"))


@router.get("", response_model=ProfileSnapshot)
def read_profile(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ProfileSnapshot:
    projects = session.scalars(
        select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at)
    ).all()
    return ProfileSnapshot(
        profile=profile_to_response(current_user.profile),
        projects=[project_to_response(project) for project in projects],
        target_role_options=list(TARGET_ROLE_OPTIONS),
    )


@router.put("", response_model=ProfileResponse)
def update_profile(
    payload: ProfilePayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ProfileResponse:
    profile = get_or_create_profile(session, current_user)
    profile.education_level = payload.education
    profile.github_url = payload.github_url
    profile.target_roles = payload.target_roles
    profile.preferred_location = payload.preferred_location
    profile.internship_type = payload.internship_type
    profile.languages = [language.model_dump() for language in payload.languages]
    profile.experience_level = payload.experience_level
    session.commit()
    session.refresh(profile)
    return profile_to_response(profile)


@router.get("/skills", response_model=SkillPayload)
def read_skills(current_user: User = current_user_dependency) -> SkillPayload:
    return SkillPayload(skills=current_user.profile.skills if current_user.profile else [])


@router.put("/skills", response_model=SkillPayload)
def update_skills(
    payload: SkillPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> SkillPayload:
    profile = get_or_create_profile(session, current_user)
    profile.skills = payload.skills
    ensure_skills(session, payload.skills)
    session.commit()
    return SkillPayload(skills=profile.skills)


@router.get("/projects", response_model=list[ProjectResponse])
def read_projects(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> list[ProjectResponse]:
    projects = session.scalars(
        select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at)
    ).all()
    return [project_to_response(project) for project in projects]


@router.put("/projects", response_model=list[ProjectResponse])
def replace_projects(
    payload: ProjectsPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> list[ProjectResponse]:
    existing_projects = session.scalars(select(Project).where(Project.user_id == current_user.id))
    for project in existing_projects:
        session.delete(project)
    session.flush()

    projects: list[Project] = []
    for project_payload in payload.projects:
        project = Project(
            user_id=current_user.id,
            name=project_payload.name,
            description=project_payload.description,
            url=project_payload.url,
            skills=project_payload.skills,
        )
        session.add(project)
        projects.append(project)

    session.commit()
    for project in projects:
        session.refresh(project)

    return [project_to_response(project) for project in projects]
