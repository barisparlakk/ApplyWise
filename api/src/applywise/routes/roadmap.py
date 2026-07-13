from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.fit_score import latest_fit_analysis
from applywise.models import JobPost, LearningRoadmap, User
from applywise.rate_limit import ai_action_limit_dependency
from applywise.roadmap import (
    RoadmapGenerationError,
    RoadmapPlan,
    build_and_store_roadmap,
    roadmap_to_plan,
)

router = APIRouter(prefix="/roadmap", tags=["roadmap"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


@router.get("", response_model=list[RoadmapPlan])
def list_roadmaps(
    duration_days: int = Query(default=3, ge=3, le=14),
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> list[RoadmapPlan]:
    if duration_days not in {3, 7, 14}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Roadmap length must be 3, 7, or 14 days.",
        )

    roadmaps = session.scalars(
        select(LearningRoadmap)
        .where(
            LearningRoadmap.user_id == current_user.id,
            LearningRoadmap.duration_days == duration_days,
        )
        .order_by(LearningRoadmap.updated_at.desc(), LearningRoadmap.created_at.desc())
    ).all()

    return [roadmap_to_plan(roadmap, roadmap.job_post) for roadmap in roadmaps]


@router.post("/{job_post_id}/regenerate", response_model=RoadmapPlan)
def regenerate_roadmap(
    job_post_id: uuid.UUID,
    duration_days: int = Query(default=3),
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
    _rate_limit: None = ai_action_limit_dependency,
) -> RoadmapPlan:
    if duration_days not in {3, 7, 14}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Roadmap length must be 3, 7, or 14 days.",
        )
    job_post = session.scalars(
        select(JobPost).where(
            JobPost.id == job_post_id,
            JobPost.user_id == current_user.id,
        )
    ).first()
    if job_post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found.")
    fit_analysis = latest_fit_analysis(session, user=current_user, job_post=job_post)
    if fit_analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fit analysis not found.",
        )
    try:
        roadmap = build_and_store_roadmap(
            session,
            user=current_user,
            fit_analysis=fit_analysis,
            job_post=job_post,
            duration_days=duration_days,
            regenerate=True,
        )
    except RoadmapGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Roadmap could not be regenerated.",
        ) from exc
    session.commit()
    session.refresh(roadmap)
    return roadmap_to_plan(roadmap, job_post)
