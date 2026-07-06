from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import FitAnalysis, JobPost, LearningRoadmap, User
from applywise.roadmap import RoadmapPlan, build_and_store_roadmap, roadmap_to_plan

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

    ensure_roadmaps_for_fit_analyses(
        session,
        user=current_user,
        duration_days=duration_days,
    )
    session.commit()

    roadmaps = session.scalars(
        select(LearningRoadmap)
        .where(
            LearningRoadmap.user_id == current_user.id,
            LearningRoadmap.duration_days == duration_days,
        )
        .order_by(LearningRoadmap.updated_at.desc(), LearningRoadmap.created_at.desc())
    ).all()

    return [roadmap_to_plan(roadmap, roadmap.job_post) for roadmap in roadmaps]


def ensure_roadmaps_for_fit_analyses(
    session: Session,
    *,
    user: User,
    duration_days: int,
) -> None:
    fit_analyses = session.scalars(
        select(FitAnalysis)
        .where(FitAnalysis.user_id == user.id)
        .order_by(FitAnalysis.updated_at.desc(), FitAnalysis.created_at.desc())
    ).all()

    for fit_analysis in fit_analyses:
        job_post = session.get(JobPost, fit_analysis.job_post_id)
        if job_post is None:
            continue
        build_and_store_roadmap(
            session,
            user=user,
            fit_analysis=fit_analysis,
            job_post=job_post,
            duration_days=duration_days,
        )
