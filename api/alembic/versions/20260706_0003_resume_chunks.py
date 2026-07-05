from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.types import UserDefinedType

revision = "20260706_0003"
down_revision = "20260705_0002"
branch_labels = None
depends_on = None


class Vector(UserDefinedType):
    cache_ok = True

    def __init__(self, dimensions: int) -> None:
        self.dimensions = dimensions

    def get_col_spec(self, **_kw: object) -> str:
        return f"vector({self.dimensions})"


def upgrade() -> None:
    op.create_table(
        "resume_chunks",
        sa.Column("resume_id", sa.Uuid(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("resume_id", "chunk_index", name="uq_resume_chunks_resume_index"),
    )
    op.create_index(op.f("ix_resume_chunks_resume_id"), "resume_chunks", ["resume_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_resume_chunks_resume_id"), table_name="resume_chunks")
    op.drop_table("resume_chunks")
