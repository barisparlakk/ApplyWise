from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260706_0006"
down_revision = "20260706_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("learning_roadmaps", sa.Column("job_post_id", sa.Uuid(), nullable=True))
    op.add_column("learning_roadmaps", sa.Column("application_id", sa.Uuid(), nullable=True))
    op.add_column(
        "learning_roadmaps",
        sa.Column("duration_days", sa.Integer(), server_default="3", nullable=False),
    )
    op.create_index(
        op.f("ix_learning_roadmaps_job_post_id"),
        "learning_roadmaps",
        ["job_post_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_learning_roadmaps_application_id"),
        "learning_roadmaps",
        ["application_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_learning_roadmaps_job_post_id_job_posts",
        "learning_roadmaps",
        "job_posts",
        ["job_post_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_learning_roadmaps_application_id_applications",
        "learning_roadmaps",
        "applications",
        ["application_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("learning_roadmaps", "duration_days", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "fk_learning_roadmaps_application_id_applications",
        "learning_roadmaps",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_learning_roadmaps_job_post_id_job_posts",
        "learning_roadmaps",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_learning_roadmaps_application_id"), table_name="learning_roadmaps")
    op.drop_index(op.f("ix_learning_roadmaps_job_post_id"), table_name="learning_roadmaps")
    op.drop_column("learning_roadmaps", "duration_days")
    op.drop_column("learning_roadmaps", "application_id")
    op.drop_column("learning_roadmaps", "job_post_id")
