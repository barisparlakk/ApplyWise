from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.types import UserDefinedType

revision = "20260705_0001"
down_revision = None
branch_labels = None
depends_on = None


class Vector(UserDefinedType):
    cache_ok = True

    def __init__(self, dimensions: int) -> None:
        self.dimensions = dimensions

    def get_col_spec(self, **_kw: object) -> str:
        return f"vector({self.dimensions})"


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


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    application_status = postgresql.ENUM(
        *APPLICATION_STATUS_VALUES,
        name="application_status",
        create_type=False,
    )
    application_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("auth_subject", sa.String(length=255), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("auth_subject"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.create_table(
        "skills",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_skills_name"), "skills", ["name"], unique=False)

    op.create_table(
        "job_posts",
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("source", sa.String(length=120), nullable=True),
        sa.Column("required_skills", sa.JSON(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_job_posts_company_name"), "job_posts", ["company_name"], unique=False)
    op.create_index(op.f("ix_job_posts_title"), "job_posts", ["title"], unique=False)
    op.create_index(op.f("ix_job_posts_user_id"), "job_posts", ["user_id"], unique=False)

    op.create_table(
        "profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("headline", sa.String(length=255), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("education_level", sa.String(length=120), nullable=True),
        sa.Column("target_roles", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_profiles_user_id"), "profiles", ["user_id"], unique=False)

    op.create_table(
        "resumes",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("parsed_data", sa.JSON(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_resumes_user_id"), "resumes", ["user_id"], unique=False)

    op.create_table(
        "projects",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_projects_user_id"), "projects", ["user_id"], unique=False)

    op.create_table(
        "github_repositories",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("owner", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=380), nullable=False),
        sa.Column("html_url", sa.String(length=2048), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("language", sa.String(length=120), nullable=True),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "full_name", name="uq_github_repositories_user_full_name"),
    )
    op.create_index(
        op.f("ix_github_repositories_full_name"),
        "github_repositories",
        ["full_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_github_repositories_user_id"),
        "github_repositories",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "github_repository_chunks",
        sa.Column("repository_id", sa.Uuid(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["repository_id"], ["github_repositories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "repository_id",
            "chunk_index",
            name="uq_github_repository_chunks_repository_index",
        ),
    )
    op.create_index(
        op.f("ix_github_repository_chunks_repository_id"),
        "github_repository_chunks",
        ["repository_id"],
        unique=False,
    )

    op.create_table(
        "applications",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_post_id", sa.Uuid(), nullable=False),
        sa.Column("status", application_status, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "job_post_id", name="uq_applications_user_job_post"),
    )
    op.create_index(
        op.f("ix_applications_job_post_id"),
        "applications",
        ["job_post_id"],
        unique=False,
    )
    op.create_index(op.f("ix_applications_status"), "applications", ["status"], unique=False)
    op.create_index(op.f("ix_applications_user_id"), "applications", ["user_id"], unique=False)

    op.create_table(
        "fit_analyses",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_post_id", sa.Uuid(), nullable=False),
        sa.Column("skill_score", sa.Float(), nullable=False),
        sa.Column("project_relevance_score", sa.Float(), nullable=False),
        sa.Column("experience_score", sa.Float(), nullable=False),
        sa.Column("education_score", sa.Float(), nullable=False),
        sa.Column("language_score", sa.Float(), nullable=False),
        sa.Column("domain_score", sa.Float(), nullable=False),
        sa.Column("profile_quality_score", sa.Float(), nullable=False),
        sa.Column("total_score", sa.Float(), nullable=False),
        sa.Column("breakdown", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_fit_analyses_job_post_id"),
        "fit_analyses",
        ["job_post_id"],
        unique=False,
    )
    op.create_index(op.f("ix_fit_analyses_user_id"), "fit_analyses", ["user_id"], unique=False)

    op.create_table(
        "interview_preps",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_post_id", sa.Uuid(), nullable=True),
        sa.Column("application_id", sa.Uuid(), nullable=True),
        sa.Column("focus_areas", sa.JSON(), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_interview_preps_application_id"),
        "interview_preps",
        ["application_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_preps_job_post_id"),
        "interview_preps",
        ["job_post_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_interview_preps_user_id"),
        "interview_preps",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "learning_roadmaps",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("fit_analysis_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["fit_analysis_id"], ["fit_analyses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_learning_roadmaps_fit_analysis_id"),
        "learning_roadmaps",
        ["fit_analysis_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_learning_roadmaps_user_id"),
        "learning_roadmaps",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "cover_letters",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_post_id", sa.Uuid(), nullable=True),
        sa.Column("application_id", sa.Uuid(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cover_letters_application_id"),
        "cover_letters",
        ["application_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_cover_letters_job_post_id"),
        "cover_letters",
        ["job_post_id"],
        unique=False,
    )
    op.create_index(op.f("ix_cover_letters_user_id"), "cover_letters", ["user_id"], unique=False)

    op.create_table(
        "application_notes",
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_application_notes_application_id"),
        "application_notes",
        ["application_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_application_notes_user_id"),
        "application_notes",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_application_notes_user_id"), table_name="application_notes")
    op.drop_index(op.f("ix_application_notes_application_id"), table_name="application_notes")
    op.drop_table("application_notes")
    op.drop_index(op.f("ix_cover_letters_user_id"), table_name="cover_letters")
    op.drop_index(op.f("ix_cover_letters_job_post_id"), table_name="cover_letters")
    op.drop_index(op.f("ix_cover_letters_application_id"), table_name="cover_letters")
    op.drop_table("cover_letters")
    op.drop_index(op.f("ix_learning_roadmaps_user_id"), table_name="learning_roadmaps")
    op.drop_index(op.f("ix_learning_roadmaps_fit_analysis_id"), table_name="learning_roadmaps")
    op.drop_table("learning_roadmaps")
    op.drop_index(op.f("ix_interview_preps_user_id"), table_name="interview_preps")
    op.drop_index(op.f("ix_interview_preps_job_post_id"), table_name="interview_preps")
    op.drop_index(op.f("ix_interview_preps_application_id"), table_name="interview_preps")
    op.drop_table("interview_preps")
    op.drop_index(op.f("ix_fit_analyses_user_id"), table_name="fit_analyses")
    op.drop_index(op.f("ix_fit_analyses_job_post_id"), table_name="fit_analyses")
    op.drop_table("fit_analyses")
    op.drop_index(op.f("ix_applications_user_id"), table_name="applications")
    op.drop_index(op.f("ix_applications_status"), table_name="applications")
    op.drop_index(op.f("ix_applications_job_post_id"), table_name="applications")
    op.drop_table("applications")
    op.drop_index(
        op.f("ix_github_repository_chunks_repository_id"),
        table_name="github_repository_chunks",
    )
    op.drop_table("github_repository_chunks")
    op.drop_index(op.f("ix_github_repositories_user_id"), table_name="github_repositories")
    op.drop_index(op.f("ix_github_repositories_full_name"), table_name="github_repositories")
    op.drop_table("github_repositories")
    op.drop_index(op.f("ix_projects_user_id"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_resumes_user_id"), table_name="resumes")
    op.drop_table("resumes")
    op.drop_index(op.f("ix_profiles_user_id"), table_name="profiles")
    op.drop_table("profiles")
    op.drop_index(op.f("ix_job_posts_user_id"), table_name="job_posts")
    op.drop_index(op.f("ix_job_posts_title"), table_name="job_posts")
    op.drop_index(op.f("ix_job_posts_company_name"), table_name="job_posts")
    op.drop_table("job_posts")
    op.drop_index(op.f("ix_skills_name"), table_name="skills")
    op.drop_table("skills")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    application_status = sa.Enum(*APPLICATION_STATUS_VALUES, name="application_status")
    application_status.drop(op.get_bind(), checkfirst=True)
