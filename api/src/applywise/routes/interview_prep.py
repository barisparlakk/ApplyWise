from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.interview_prep import (
    SECTION_KEYS,
    InterviewPrepContent,
    InterviewPrepSection,
    generate_or_update_interview_prep,
    interview_prep_to_content,
)
from applywise.models import Application, InterviewPrep, User
from applywise.rate_limit import ai_action_limit_dependency

router = APIRouter(prefix="/interview-prep", tags=["interview-prep"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


class InterviewPrepJobResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    title: str
    domain: str | None
    required_skills: list[str]
    nice_to_have_skills: list[str]


class InterviewPrepApplicationResponse(BaseModel):
    id: uuid.UUID
    status: str
    job_post_id: uuid.UUID


class InterviewPrepResponse(BaseModel):
    id: uuid.UUID
    application: InterviewPrepApplicationResponse
    job: InterviewPrepJobResponse
    focus_areas: list[str]
    content: InterviewPrepContent


class RegenerateInterviewPrepPayload(BaseModel):
    sections: list[InterviewPrepSection] = Field(min_length=1, max_length=len(SECTION_KEYS))

    @field_validator("sections")
    @classmethod
    def validate_sections(cls, value: list[InterviewPrepSection]) -> list[InterviewPrepSection]:
        unique_sections: list[InterviewPrepSection] = []
        for section in value:
            if section not in SECTION_KEYS:
                raise ValueError(f"Unsupported section: {section}")
            if section not in unique_sections:
                unique_sections.append(section)
        return unique_sections


@router.get("/{application_id}", response_model=InterviewPrepResponse)
def read_interview_prep(
    application_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> InterviewPrepResponse:
    application = get_owned_application(session, current_user, application_id)
    prep = find_existing_interview_prep(session, current_user, application)
    if prep is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview prep has not been generated yet.",
        )
    return interview_prep_to_response(prep, application)


@router.post("/{application_id}", response_model=InterviewPrepResponse)
def generate_interview_prep(
    application_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
    _rate_limit: None = ai_action_limit_dependency,
) -> InterviewPrepResponse:
    application = get_owned_application(session, current_user, application_id)
    existing = find_existing_interview_prep(session, current_user, application)
    if existing is not None:
        return interview_prep_to_response(existing, application)
    prep = generate_or_update_interview_prep(session, user=current_user, application=application)
    session.commit()
    session.refresh(prep)
    return interview_prep_to_response(prep, application)


@router.post("/{application_id}/regenerate", response_model=InterviewPrepResponse)
def regenerate_interview_prep(
    application_id: uuid.UUID,
    payload: RegenerateInterviewPrepPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
    _rate_limit: None = ai_action_limit_dependency,
) -> InterviewPrepResponse:
    application = get_owned_application(session, current_user, application_id)
    prep = generate_or_update_interview_prep(
        session,
        user=current_user,
        application=application,
        sections=payload.sections,
    )
    session.commit()
    session.refresh(prep)
    return interview_prep_to_response(prep, application)


def find_existing_interview_prep(
    session: Session,
    user: User,
    application: Application,
) -> InterviewPrep | None:
    return session.scalars(
        select(InterviewPrep)
        .where(
            InterviewPrep.user_id == user.id,
            InterviewPrep.application_id == application.id,
        )
        .order_by(InterviewPrep.updated_at.desc(), InterviewPrep.created_at.desc())
        .limit(1)
    ).first()


def get_owned_application(
    session: Session,
    user: User,
    application_id: uuid.UUID,
) -> Application:
    application = session.scalars(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == user.id,
        )
    ).first()
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found.",
        )
    return application


def interview_prep_to_response(
    prep: InterviewPrep,
    application: Application,
) -> InterviewPrepResponse:
    job_post = application.job_post
    if job_post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application job post not found.",
        )
    return InterviewPrepResponse(
        id=prep.id,
        application=InterviewPrepApplicationResponse(
            id=application.id,
            status=application.status.value,
            job_post_id=application.job_post_id,
        ),
        job=InterviewPrepJobResponse(
            id=job_post.id,
            company_name=job_post.company_name,
            title=job_post.title,
            domain=job_post.domain,
            required_skills=job_post.required_skills or [],
            nice_to_have_skills=job_post.nice_to_have_skills or [],
        ),
        focus_areas=prep.focus_areas or [],
        content=interview_prep_to_content(prep),
    )
