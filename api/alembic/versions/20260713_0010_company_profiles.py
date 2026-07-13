from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260713_0010"
down_revision = "20260713_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_post_id", sa.Uuid(), nullable=False),
        sa.Column("what_company_does", sa.Text(), nullable=False),
        sa.Column("likely_interview_angles", sa.JSON(), nullable=False),
        sa.Column("projects_to_emphasize", sa.JSON(), nullable=False),
        sa.Column("smart_questions", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "job_post_id",
            name="uq_company_profiles_user_job_post",
        ),
    )
    op.create_index(
        op.f("ix_company_profiles_job_post_id"),
        "company_profiles",
        ["job_post_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_company_profiles_user_id"),
        "company_profiles",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_company_profiles_user_id"), table_name="company_profiles")
    op.drop_index(op.f("ix_company_profiles_job_post_id"), table_name="company_profiles")
    op.drop_table("company_profiles")
