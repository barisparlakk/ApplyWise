from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260713_0009"
down_revision = "20260713_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resume_versions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("source_resume_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("target_role", sa.String(length=120), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("parsed_data", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_resume_id"], ["resumes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_resume_versions_user_name"),
    )
    op.create_index(
        op.f("ix_resume_versions_source_resume_id"),
        "resume_versions",
        ["source_resume_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resume_versions_target_role"),
        "resume_versions",
        ["target_role"],
        unique=False,
    )
    op.create_index(
        op.f("ix_resume_versions_user_id"),
        "resume_versions",
        ["user_id"],
        unique=False,
    )

    op.add_column("applications", sa.Column("resume_version_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_applications_resume_version_id"),
        "applications",
        ["resume_version_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_applications_resume_version_id_resume_versions",
        "applications",
        "resume_versions",
        ["resume_version_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_applications_resume_version_id_resume_versions",
        "applications",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_applications_resume_version_id"), table_name="applications")
    op.drop_column("applications", "resume_version_id")

    op.drop_index(op.f("ix_resume_versions_user_id"), table_name="resume_versions")
    op.drop_index(op.f("ix_resume_versions_target_role"), table_name="resume_versions")
    op.drop_index(op.f("ix_resume_versions_source_resume_id"), table_name="resume_versions")
    op.drop_table("resume_versions")
