from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import Application, ApplicationStatus, JobPost, User

router = APIRouter(prefix="/applications", tags=["applications"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    job_post_id: uuid.UUID
    status: ApplicationStatus
    notes: str | None


def application_to_response(application: Application) -> ApplicationResponse:
    return ApplicationResponse(
        id=application.id,
        job_post_id=application.job_post_id,
        status=application.status,
        notes=application.notes,
    )


@router.post("/from-job/{job_post_id}", response_model=ApplicationResponse)
def create_application_from_job(
    job_post_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ApplicationResponse:
    job_post = session.scalars(
        select(JobPost).where(JobPost.id == job_post_id, JobPost.user_id == current_user.id)
    ).first()
    if job_post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found.")

    application = session.scalars(
        select(Application).where(
            Application.user_id == current_user.id,
            Application.job_post_id == job_post.id,
        )
    ).first()
    if application is None:
        application = Application(
            user_id=current_user.id,
            job_post_id=job_post.id,
            status=ApplicationStatus.PREPARING,
        )
        session.add(application)
    elif application.status == ApplicationStatus.SAVED:
        application.status = ApplicationStatus.PREPARING

    session.commit()
    session.refresh(application)
    return application_to_response(application)
