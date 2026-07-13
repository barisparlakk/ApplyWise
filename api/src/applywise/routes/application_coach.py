from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.application_coach import ApplicationCoachResponse, build_application_coach
from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.fit_score import compute_and_store_fit_analysis, latest_fit_analysis
from applywise.models import JobPost, User

router = APIRouter(prefix="/coach", tags=["application-coach"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


@router.get("/jobs/{job_post_id}", response_model=ApplicationCoachResponse)
def read_application_coach(
    job_post_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ApplicationCoachResponse:
    job_post = session.scalar(
        select(JobPost).where(
            JobPost.id == job_post_id,
            JobPost.user_id == current_user.id,
        )
    )
    if job_post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found.",
        )

    fit_analysis = latest_fit_analysis(session, user=current_user, job_post=job_post)
    if fit_analysis is None:
        fit_analysis = compute_and_store_fit_analysis(
            session,
            user=current_user,
            job_post=job_post,
        )
        session.commit()
        session.refresh(fit_analysis)
    return build_application_coach(fit_analysis=fit_analysis, job_post=job_post)
