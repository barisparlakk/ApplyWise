from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260705_0002"
down_revision = "20260705_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column("skills", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column("profiles", sa.Column("github_url", sa.String(length=2048), nullable=True))
    op.add_column(
        "profiles",
        sa.Column("preferred_location", sa.String(length=255), nullable=True),
    )
    op.add_column("profiles", sa.Column("internship_type", sa.String(length=120), nullable=True))
    op.add_column(
        "profiles",
        sa.Column("languages", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column("profiles", sa.Column("experience_level", sa.String(length=120), nullable=True))
    op.alter_column("profiles", "skills", server_default=None)
    op.alter_column("profiles", "languages", server_default=None)


def downgrade() -> None:
    op.drop_column("profiles", "experience_level")
    op.drop_column("profiles", "languages")
    op.drop_column("profiles", "internship_type")
    op.drop_column("profiles", "preferred_location")
    op.drop_column("profiles", "github_url")
    op.drop_column("profiles", "skills")
