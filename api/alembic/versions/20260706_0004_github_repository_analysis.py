from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260706_0004"
down_revision = "20260706_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "github_repositories",
        sa.Column("default_branch", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "github_repositories",
        sa.Column("last_commit_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "github_repositories",
        sa.Column("readme_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "github_repositories",
        sa.Column("languages", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
    )
    op.add_column(
        "github_repositories",
        sa.Column("file_tree", sa.JSON(), server_default=sa.text("'[]'::json"), nullable=False),
    )
    op.add_column(
        "github_repositories",
        sa.Column(
            "deterministic_signals",
            sa.JSON(),
            server_default=sa.text("'{}'::json"),
            nullable=False,
        ),
    )
    op.add_column(
        "github_repositories",
        sa.Column(
            "analysis_data",
            sa.JSON(),
            server_default=sa.text("'{}'::json"),
            nullable=False,
        ),
    )
    op.alter_column("github_repositories", "languages", server_default=None)
    op.alter_column("github_repositories", "file_tree", server_default=None)
    op.alter_column("github_repositories", "deterministic_signals", server_default=None)
    op.alter_column("github_repositories", "analysis_data", server_default=None)


def downgrade() -> None:
    op.drop_column("github_repositories", "analysis_data")
    op.drop_column("github_repositories", "deterministic_signals")
    op.drop_column("github_repositories", "file_tree")
    op.drop_column("github_repositories", "languages")
    op.drop_column("github_repositories", "readme_text")
    op.drop_column("github_repositories", "last_commit_at")
    op.drop_column("github_repositories", "default_branch")
