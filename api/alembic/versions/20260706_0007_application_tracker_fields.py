from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260706_0007"
down_revision = "20260706_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("deadline", sa.Date(), nullable=True))
    op.add_column("applications", sa.Column("applied_date", sa.Date(), nullable=True))
    op.add_column("applications", sa.Column("interview_date", sa.Date(), nullable=True))
    op.add_column("applications", sa.Column("next_action", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "next_action")
    op.drop_column("applications", "interview_date")
    op.drop_column("applications", "applied_date")
    op.drop_column("applications", "deadline")
