from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Response, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import inspect as sqlalchemy_inspect
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import JobPost, JobSkillMapping, User

router = APIRouter(prefix="/auth", tags=["auth"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


class CurrentUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: User = current_user_dependency) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
    )


@router.get("/me/export", response_class=JSONResponse)
def export_current_user_data(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> JSONResponse:
    payload = {
        "format_version": 1,
        "exported_at": datetime.now(UTC),
        "account": export_record(current_user, excluded={"auth_subject"}),
        "profile": export_record(current_user.profile) if current_user.profile else None,
        "resumes": [export_record(record) for record in current_user.resumes],
        "resume_versions": [
            export_record(record) for record in current_user.resume_versions
        ],
        "projects": [export_record(record) for record in current_user.projects],
        "github_repositories": [
            export_record(record) for record in current_user.github_repositories
        ],
        "job_posts": [export_record(record) for record in current_user.job_posts],
        "job_skill_mappings": [
            export_record(record)
            for record in session.scalars(
                select(JobSkillMapping)
                .join(JobPost)
                .where(JobPost.user_id == current_user.id)
            )
        ],
        "company_profiles": [
            export_record(record) for record in current_user.company_profiles
        ],
        "applications": [export_record(record) for record in current_user.applications],
        "fit_analyses": [export_record(record) for record in current_user.fit_analyses],
        "interview_preps": [export_record(record) for record in current_user.interview_preps],
        "learning_roadmaps": [
            export_record(record) for record in current_user.learning_roadmaps
        ],
        "cover_letters": [export_record(record) for record in current_user.cover_letters],
        "application_notes": [
            export_record(record) for record in current_user.application_notes
        ],
    }
    return JSONResponse(
        content=jsonable_encoder(payload),
        headers={
            "Content-Disposition": 'attachment; filename="applywise-data-export.json"',
            "Cache-Control": "no-store",
        },
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> Response:
    session.delete(current_user)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def export_record(
    record: object,
    *,
    excluded: set[str] | None = None,
) -> dict[str, Any]:
    excluded_fields = {"embedding", "embedding_model", "user_id", *(excluded or set())}
    mapper = sqlalchemy_inspect(type(record))
    return {
        attribute.key: getattr(record, attribute.key)
        for attribute in mapper.column_attrs
        if attribute.key not in excluded_fields
    }
