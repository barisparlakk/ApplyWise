from __future__ import annotations

import json
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260713_0012"
down_revision = "20260713_0011"
branch_labels = None
depends_on = None

APPLICATION_STATUS_VALUES: Sequence[str] = (
    "saved",
    "preparing",
    "applied",
    "assessment",
    "interview",
    "rejected",
    "offer",
    "archived",
)
GOAL_STATUS_VALUES: Sequence[str] = ("active", "completed", "archived")


def upgrade() -> None:
    application_status = postgresql.ENUM(
        *APPLICATION_STATUS_VALUES,
        name="application_status",
        create_type=False,
    )
    goal_status = postgresql.ENUM(
        *GOAL_STATUS_VALUES,
        name="goal_status",
        create_type=False,
    )
    goal_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "application_events",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("from_status", application_status, nullable=True),
        sa.Column("to_status", application_status, nullable=True),
        sa.Column("event_data", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_application_events_application_id"),
        "application_events",
        ["application_id"],
        unique=False,
    )
    op.create_index(
        "ix_application_events_event_type",
        "application_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_application_events_user_id"),
        "application_events",
        ["user_id"],
        unique=False,
    )
    backfill_application_events()

    op.create_table(
        "user_goals",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("target_role", sa.String(length=120), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("weekly_application_target", sa.Integer(), nullable=False),
        sa.Column("status", goal_status, nullable=False),
        sa.Column("progress_data", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "weekly_application_target BETWEEN 1 AND 50",
            name="ck_user_goals_weekly_target_range",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_user_goals_status",
        "user_goals",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_user_goals_target_date",
        "user_goals",
        ["target_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_goals_user_id"),
        "user_goals",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_goals_user_id"), table_name="user_goals")
    op.drop_index("ix_user_goals_target_date", table_name="user_goals")
    op.drop_index("ix_user_goals_status", table_name="user_goals")
    op.drop_table("user_goals")
    op.drop_index(op.f("ix_application_events_user_id"), table_name="application_events")
    op.drop_index("ix_application_events_event_type", table_name="application_events")
    op.drop_index(
        op.f("ix_application_events_application_id"),
        table_name="application_events",
    )
    op.drop_table("application_events")
    goal_status = sa.Enum(*GOAL_STATUS_VALUES, name="goal_status")
    goal_status.drop(op.get_bind(), checkfirst=True)


def backfill_application_events() -> None:
    connection = op.get_bind()
    applications = connection.execute(
        sa.text("SELECT id, user_id, status, created_at FROM applications")
    ).mappings()
    for application in applications:
        connection.execute(
            sa.text(
                "INSERT INTO application_events "
                "(id, user_id, application_id, event_type, from_status, to_status, "
                "event_data, created_at, updated_at) "
                "VALUES (:id, :user_id, :application_id, 'backfilled', NULL, :to_status, "
                "CAST(:event_data AS JSON), :created_at, :updated_at)"
            ),
            {
                "id": uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"https://applywise.dev/application-events/backfill/{application['id']}",
                ),
                "user_id": application["user_id"],
                "application_id": application["id"],
                "to_status": application["status"],
                "event_data": json.dumps({"migration": revision}),
                "created_at": application["created_at"],
                "updated_at": application["created_at"],
            },
        )
