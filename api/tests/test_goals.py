from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.models import Application, Base, GoalStatus, JobPost, User
from applywise.routes.goals import (
    CreateGoalPayload,
    UpdateGoalPayload,
    create_goal,
    delete_goal,
    list_goals,
    update_goal,
)


def test_goal_crud_calculates_weekly_application_progress_and_ownership() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="goals@example.com")
        other_user = User(email="other-goals@example.com")
        session.add_all([user, other_user])
        session.flush()
        job_post = JobPost(
            user_id=user.id,
            company_name="Goal Labs",
            title="Backend Intern",
            description="Build APIs",
        )
        session.add(job_post)
        session.flush()
        session.add(
            Application(
                user_id=user.id,
                job_post_id=job_post.id,
                applied_date=date.today(),
            )
        )
        session.commit()

        created = create_goal(
            CreateGoalPayload(
                title="  Apply consistently  ",
                target_role="Backend Intern",
                target_date=date.today() + timedelta(days=30),
                weekly_application_target=4,
            ),
            current_user=user,
            session=session,
        )
        listed = list_goals(current_user=user, session=session)
        updated = update_goal(
            created.id,
            UpdateGoalPayload(
                weekly_application_target=2,
                status=GoalStatus.COMPLETED,
            ),
            current_user=user,
            session=session,
        )
        with pytest.raises(HTTPException) as exc_info:
            update_goal(
                created.id,
                UpdateGoalPayload(title="Taken over"),
                current_user=other_user,
                session=session,
            )
        deleted = delete_goal(created.id, current_user=user, session=session)

    assert created.title == "Apply consistently"
    assert created.weekly_progress == 1
    assert created.progress_percent == 25
    assert len(listed) == 1
    assert updated.status == GoalStatus.COMPLETED
    assert updated.progress_percent == 50
    assert exc_info.value.status_code == 404
    assert deleted.status_code == 204


def test_goal_payload_rejects_whitespace_title() -> None:
    with pytest.raises(ValueError):
        CreateGoalPayload(title="   ")
    with pytest.raises(ValueError):
        UpdateGoalPayload(status=None)
