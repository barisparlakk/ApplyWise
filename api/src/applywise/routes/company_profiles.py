from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.company_profile import ProjectEmphasis, generate_and_store_company_profile
from applywise.database import get_session
from applywise.models import CompanyProfile, JobPost, User
from applywise.rate_limit import ai_action_limit_dependency

router = APIRouter(prefix="/company-profiles", tags=["company-profiles"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


class CompanyProfileResponse(BaseModel):
    id: uuid.UUID
    job_post_id: uuid.UUID
    company_name: str
    role: str
    evidence_basis: str
    what_company_does: str
    likely_interview_angles: list[str]
    projects_to_emphasize: list[ProjectEmphasis]
    smart_questions: list[str]
    updated_at: str


@router.get("/job/{job_post_id}", response_model=CompanyProfileResponse | None)
def read_company_profile(
    job_post_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> CompanyProfileResponse | None:
    job_post = owned_job_post(session, current_user, job_post_id)
    profile = session.scalar(
        select(CompanyProfile).where(
            CompanyProfile.user_id == current_user.id,
            CompanyProfile.job_post_id == job_post.id,
        )
    )
    return company_profile_to_response(profile, job_post) if profile else None


@router.post("/job/{job_post_id}", response_model=CompanyProfileResponse)
def generate_company_profile(
    job_post_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
    _rate_limit: None = ai_action_limit_dependency,
) -> CompanyProfileResponse:
    job_post = owned_job_post(session, current_user, job_post_id)
    profile = generate_and_store_company_profile(
        session,
        user=current_user,
        job_post=job_post,
    )
    session.commit()
    session.refresh(profile)
    return company_profile_to_response(profile, job_post)


def owned_job_post(session: Session, user: User, job_post_id: uuid.UUID) -> JobPost:
    job_post = session.scalar(
        select(JobPost).where(JobPost.id == job_post_id, JobPost.user_id == user.id)
    )
    if job_post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found.",
        )
    return job_post


def company_profile_to_response(
    profile: CompanyProfile,
    job_post: JobPost,
) -> CompanyProfileResponse:
    return CompanyProfileResponse(
        id=profile.id,
        job_post_id=profile.job_post_id,
        company_name=job_post.company_name,
        role=job_post.title,
        evidence_basis="job_post_and_candidate_evidence",
        what_company_does=profile.what_company_does,
        likely_interview_angles=[str(item) for item in profile.likely_interview_angles],
        projects_to_emphasize=[
            ProjectEmphasis.model_validate(item) for item in profile.projects_to_emphasize
        ],
        smart_questions=[str(item) for item in profile.smart_questions],
        updated_at=profile.updated_at.isoformat(),
    )
