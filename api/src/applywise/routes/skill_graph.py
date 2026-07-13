from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import JobPost, User
from applywise.skill_graph import SkillGraphResponse, build_job_skill_graph

router = APIRouter(prefix="/skill-graph", tags=["skill-graph"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


@router.get("/jobs/{job_post_id}", response_model=SkillGraphResponse)
def read_job_skill_graph(
    job_post_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> SkillGraphResponse:
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
    response = build_job_skill_graph(session, user=current_user, job_post=job_post)
    session.commit()
    return response
