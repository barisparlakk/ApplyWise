from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.models import Application, GoalStatus, User, UserGoal

router = APIRouter(prefix="/goals", tags=["goals"])
MAX_GOALS_PER_USER = 20
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)


class GoalResponse(BaseModel):
    id: uuid.UUID
    title: str
    target_role: str | None
    target_date: date | None
    weekly_application_target: int
    status: GoalStatus
    weekly_progress: int
    progress_percent: float
    days_remaining: int | None
    updated_at: str


class CreateGoalPayload(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    target_role: str | None = Field(default=None, max_length=120)
    target_date: date | None = None
    weekly_application_target: int = Field(default=5, ge=1, le=50)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("Goal title is too short.")
        return stripped

    @field_validator("target_role")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class UpdateGoalPayload(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    target_role: str | None = Field(default=None, max_length=120)
    target_date: date | None = None
    weekly_application_target: int | None = Field(default=None, ge=1, le=50)
    status: GoalStatus | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("Goal title is too short.")
        return stripped

    @field_validator("target_role")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> UpdateGoalPayload:
        for field in ("title", "weekly_application_target", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null.")
        return self


@router.get("", response_model=list[GoalResponse])
def list_goals(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> list[GoalResponse]:
    goals = session.scalars(
        select(UserGoal)
        .where(UserGoal.user_id == current_user.id)
        .order_by(UserGoal.status.asc(), UserGoal.target_date.asc(), UserGoal.created_at.desc())
    ).all()
    weekly_progress = current_week_application_count(session, current_user)
    return [goal_to_response(goal, weekly_progress) for goal in goals]


@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: CreateGoalPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> GoalResponse:
    goal_count = session.scalar(
        select(func.count(UserGoal.id)).where(UserGoal.user_id == current_user.id)
    )
    if int(goal_count or 0) >= MAX_GOALS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A maximum of {MAX_GOALS_PER_USER} goals is allowed.",
        )
    goal = UserGoal(
        user_id=current_user.id,
        title=payload.title,
        target_role=payload.target_role,
        target_date=payload.target_date,
        weekly_application_target=payload.weekly_application_target,
        status=GoalStatus.ACTIVE,
        progress_data={},
    )
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal_to_response(goal, current_week_application_count(session, current_user))


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: uuid.UUID,
    payload: UpdateGoalPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> GoalResponse:
    goal = get_owned_goal(session, current_user, goal_id)
    for field in payload.model_fields_set:
        setattr(goal, field, getattr(payload, field))
    session.commit()
    session.refresh(goal)
    return goal_to_response(goal, current_week_application_count(session, current_user))


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> Response:
    goal = get_owned_goal(session, current_user, goal_id)
    session.delete(goal)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def get_owned_goal(session: Session, user: User, goal_id: uuid.UUID) -> UserGoal:
    goal = session.scalar(
        select(UserGoal).where(UserGoal.id == goal_id, UserGoal.user_id == user.id)
    )
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found.")
    return goal


def current_week_application_count(session: Session, user: User) -> int:
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    return int(
        session.scalar(
            select(func.count(Application.id)).where(
                Application.user_id == user.id,
                Application.applied_date >= week_start,
                Application.applied_date <= week_end,
            )
        )
        or 0
    )


def goal_to_response(goal: UserGoal, weekly_progress: int) -> GoalResponse:
    today = date.today()
    return GoalResponse(
        id=goal.id,
        title=goal.title,
        target_role=goal.target_role,
        target_date=goal.target_date,
        weekly_application_target=goal.weekly_application_target,
        status=goal.status,
        weekly_progress=weekly_progress,
        progress_percent=round(
            min(100.0, (weekly_progress / goal.weekly_application_target) * 100),
            2,
        ),
        days_remaining=(goal.target_date - today).days if goal.target_date else None,
        updated_at=goal.updated_at.isoformat(),
    )
