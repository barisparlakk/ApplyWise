from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260706_0005"
down_revision = "20260706_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "job_posts",
        sa.Column(
            "nice_to_have_skills",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "job_posts",
        sa.Column(
            "responsibilities",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column("job_posts", sa.Column("seniority_level", sa.String(length=120), nullable=True))
    op.add_column("job_posts", sa.Column("domain", sa.String(length=120), nullable=True))
    op.add_column(
        "job_posts",
        sa.Column(
            "hidden_expectations",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "job_posts",
        sa.Column("english_requirement", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "job_posts",
        sa.Column("technical_difficulty", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "job_posts",
        sa.Column(
            "business_expectations",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "job_posts",
        sa.Column(
            "communication_expectations",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "job_posts",
        sa.Column(
            "analysis_data",
            sa.JSON(),
            server_default=sa.text("'{}'::json"),
            nullable=False,
        ),
    )
    op.alter_column("job_posts", "nice_to_have_skills", server_default=None)
    op.alter_column("job_posts", "responsibilities", server_default=None)
    op.alter_column("job_posts", "hidden_expectations", server_default=None)
    op.alter_column("job_posts", "business_expectations", server_default=None)
    op.alter_column("job_posts", "communication_expectations", server_default=None)
    op.alter_column("job_posts", "analysis_data", server_default=None)


def downgrade() -> None:
    op.drop_column("job_posts", "analysis_data")
    op.drop_column("job_posts", "communication_expectations")
    op.drop_column("job_posts", "business_expectations")
    op.drop_column("job_posts", "technical_difficulty")
    op.drop_column("job_posts", "english_requirement")
    op.drop_column("job_posts", "hidden_expectations")
    op.drop_column("job_posts", "domain")
    op.drop_column("job_posts", "seniority_level")
    op.drop_column("job_posts", "responsibilities")
    op.drop_column("job_posts", "nice_to_have_skills")
