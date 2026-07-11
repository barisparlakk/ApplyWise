from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import Profile, Resume, User
from applywise.routes.profile import (
    TARGET_ROLE_OPTIONS,
    ensure_skills,
    get_or_create_profile,
    normalize_tags,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)

ENGLISH_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2", "Native")


class OnboardingPayload(BaseModel):
    education: str = Field(min_length=2, max_length=120)
    target_roles: list[str] = Field(min_length=1, max_length=len(TARGET_ROLE_OPTIONS))
    experience_level: str = Field(min_length=2, max_length=120)
    english_level: str = Field(min_length=2, max_length=80)
    skills: list[str] = Field(min_length=1, max_length=100)

    @field_validator("education", "experience_level", "english_level")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Onboarding fields cannot be empty.")
        return stripped

    @field_validator("target_roles")
    @classmethod
    def validate_target_roles(cls, value: list[str]) -> list[str]:
        roles = normalize_tags(value)
        invalid_roles = [role for role in roles if role not in TARGET_ROLE_OPTIONS]
        if invalid_roles:
            raise ValueError(f"Unsupported target role: {invalid_roles[0]}")
        if not roles:
            raise ValueError("Select at least one target role.")
        return roles

    @field_validator("english_level")
    @classmethod
    def validate_english_level(cls, value: str) -> str:
        level = value.strip()
        if level not in ENGLISH_LEVELS:
            raise ValueError("Unsupported English level.")
        return level

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, value: list[str]) -> list[str]:
        skills = normalize_tags(value)
        if not skills:
            raise ValueError("Add at least one skill.")
        return skills


class OnboardingStatusResponse(BaseModel):
    completed: bool
    resume_uploaded: bool
    missing_fields: list[str]


def latest_resume(session: Session, user: User) -> Resume | None:
    return session.scalars(
        select(Resume)
        .where(Resume.user_id == user.id)
        .order_by(Resume.created_at.desc(), Resume.id.desc())
        .limit(1)
    ).first()


def build_onboarding_status(
    *,
    profile: Profile | None,
    resume: Resume | None,
) -> OnboardingStatusResponse:
    missing_fields: list[str] = []
    if resume is None:
        missing_fields.append("resume")
    if profile is None or not profile.education_level:
        missing_fields.append("education")
    if profile is None or not profile.target_roles:
        missing_fields.append("target_roles")
    if profile is None or not profile.experience_level:
        missing_fields.append("experience_level")
    if profile is None or not profile.skills:
        missing_fields.append("skills")

    languages: list[dict[str, Any]] = profile.languages or [] if profile is not None else []
    has_english = any(
        str(language.get("name", "")).casefold() == "english"
        and bool(str(language.get("level", "")).strip())
        for language in languages
    )
    if not has_english:
        missing_fields.append("english_level")

    return OnboardingStatusResponse(
        completed=not missing_fields,
        resume_uploaded=resume is not None,
        missing_fields=missing_fields,
    )


@router.get("", response_model=OnboardingStatusResponse)
def read_onboarding_status(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> OnboardingStatusResponse:
    return build_onboarding_status(
        profile=current_user.profile,
        resume=latest_resume(session, current_user),
    )


@router.put("", response_model=OnboardingStatusResponse)
def complete_onboarding(
    payload: OnboardingPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> OnboardingStatusResponse:
    resume = latest_resume(session, current_user)
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Upload a CV before completing onboarding.",
        )

    profile = get_or_create_profile(session, current_user)
    profile.education_level = payload.education
    profile.target_roles = payload.target_roles
    profile.experience_level = payload.experience_level
    profile.skills = payload.skills

    existing_languages: list[dict[str, Any]] = profile.languages or []
    non_english_languages = [
        language
        for language in existing_languages
        if str(language.get("name", "")).casefold() != "english"
    ]
    profile.languages = [
        {"name": "English", "level": payload.english_level},
        *non_english_languages,
    ]
    ensure_skills(session, payload.skills)

    session.commit()
    session.refresh(profile)
    return build_onboarding_status(profile=profile, resume=resume)
