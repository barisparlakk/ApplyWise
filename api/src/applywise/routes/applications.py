from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import (
    Application,
    ApplicationStatus,
    FitAnalysis,
    InterviewPrep,
    JobPost,
    User,
)

router = APIRouter(prefix="/applications", tags=["applications"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)

class ApplicationResponse(BaseModel):
    id: uuid.UUID
    job_post_id: uuid.UUID
    fit_analysis_id: uuid.UUID | None
    interview_prep_id: uuid.UUID | None
    company: str
    role: str
    status: ApplicationStatus
    deadline: date | None
    job_url: str | None
    fit_score: float | None
    applied_date: date | None
    interview_date: date | None
    notes: str | None
    next_action: str | None
    updated_at: str


class CreateApplicationPayload(BaseModel):
    status: ApplicationStatus = ApplicationStatus.SAVED
    next_action: str | None = Field(default=None, max_length=500)

    @field_validator("next_action")
    @classmethod
    def strip_next_action(cls, value: str | None) -> str | None:
        return strip_optional_text(value)


class UpdateApplicationPayload(BaseModel):
    status: ApplicationStatus | None = None
    deadline: date | None = None
    job_url: str | None = Field(default=None, max_length=2048)
    applied_date: date | None = None
    interview_date: date | None = None
    notes: str | None = None
    next_action: str | None = Field(default=None, max_length=500)

    @field_validator("job_url", "notes", "next_action")
    @classmethod
    def strip_optional_fields(cls, value: str | None) -> str | None:
        return strip_optional_text(value)


def application_to_response(
    session: Session,
    application: Application,
) -> ApplicationResponse:
    fit_analysis = latest_fit_analysis(session, application)
    interview_prep = latest_interview_prep(session, application)
    job_post = application.job_post
    return ApplicationResponse(
        id=application.id,
        job_post_id=application.job_post_id,
        fit_analysis_id=fit_analysis.id if fit_analysis else None,
        interview_prep_id=interview_prep.id if interview_prep else None,
        company=job_post.company_name,
        role=job_post.title,
        status=application.status,
        deadline=application.deadline,
        job_url=job_post.url,
        fit_score=fit_analysis.total_score if fit_analysis else None,
        applied_date=application.applied_date,
        interview_date=application.interview_date,
        notes=application.notes,
        next_action=application.next_action,
        updated_at=application.updated_at.isoformat(),
    )


@router.post("/from-job/{job_post_id}", response_model=ApplicationResponse)
def create_application_from_job(
    job_post_id: uuid.UUID,
    payload: CreateApplicationPayload | None = None,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ApplicationResponse:
    payload = payload or CreateApplicationPayload()
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
            status=payload.status,
            next_action=payload.next_action,
        )
        session.add(application)
    elif should_update_status(application.status, payload.status):
        application.status = payload.status
        if payload.next_action is not None:
            application.next_action = payload.next_action
    elif payload.next_action is not None:
        application.next_action = payload.next_action

    session.commit()
    session.refresh(application)
    return application_to_response(session, application)


@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> list[ApplicationResponse]:
    applications = session.scalars(
        select(Application)
        .join(JobPost)
        .where(Application.user_id == current_user.id)
        .order_by(Application.updated_at.desc(), Application.created_at.desc())
    ).all()
    return [application_to_response(session, application) for application in applications]


@router.get("/{application_id}", response_model=ApplicationResponse)
def read_application(
    application_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ApplicationResponse:
    application = get_owned_application(session, current_user, application_id)
    return application_to_response(session, application)


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: uuid.UUID,
    payload: UpdateApplicationPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ApplicationResponse:
    application = get_owned_application(session, current_user, application_id)
    if payload.status is not None:
        application.status = payload.status
    if "deadline" in payload.model_fields_set:
        application.deadline = payload.deadline
    if "applied_date" in payload.model_fields_set:
        application.applied_date = payload.applied_date
    if "interview_date" in payload.model_fields_set:
        application.interview_date = payload.interview_date
    if "notes" in payload.model_fields_set:
        application.notes = payload.notes
    if "next_action" in payload.model_fields_set:
        application.next_action = payload.next_action
    if "job_url" in payload.model_fields_set:
        application.job_post.url = payload.job_url

    if application.status == ApplicationStatus.APPLIED and application.applied_date is None:
        application.applied_date = date.today()
    if application.status == ApplicationStatus.INTERVIEW and application.interview_date is None:
        application.interview_date = date.today()

    session.commit()
    session.refresh(application)
    return application_to_response(session, application)


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


def should_update_status(
    current_status: ApplicationStatus,
    requested_status: ApplicationStatus,
) -> bool:
    if current_status == requested_status:
        return False
    if requested_status == ApplicationStatus.PREPARING:
        return current_status in {ApplicationStatus.SAVED, ApplicationStatus.PREPARING}
    if requested_status == ApplicationStatus.SAVED:
        return current_status == ApplicationStatus.SAVED
    return True


def latest_fit_analysis(session: Session, application: Application) -> FitAnalysis | None:
    return session.scalars(
        select(FitAnalysis)
        .where(
            FitAnalysis.user_id == application.user_id,
            FitAnalysis.job_post_id == application.job_post_id,
        )
        .order_by(FitAnalysis.updated_at.desc(), FitAnalysis.created_at.desc())
        .limit(1)
    ).first()


def latest_interview_prep(session: Session, application: Application) -> InterviewPrep | None:
    return session.scalars(
        select(InterviewPrep)
        .where(
            InterviewPrep.user_id == application.user_id,
            InterviewPrep.application_id == application.id,
        )
        .order_by(InterviewPrep.updated_at.desc(), InterviewPrep.created_at.desc())
        .limit(1)
    ).first()


def strip_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None
