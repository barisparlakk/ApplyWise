from __future__ import annotations

import enum
import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import UserDefinedType, Uuid

EMBEDDING_DIMENSIONS = 1536


def utc_now() -> datetime:
    return datetime.now(UTC)


class Vector(UserDefinedType):
    cache_ok = True

    def __init__(self, dimensions: int = EMBEDDING_DIMENSIONS) -> None:
        self.dimensions = dimensions

    def get_col_spec(self, **_kw: object) -> str:
        return f"vector({self.dimensions})"

    def bind_processor(self, _dialect: object) -> Callable[[list[float] | None], str | None]:
        def process(value: list[float] | None) -> str | None:
            if value is None:
                return None
            return "[" + ",".join(f"{item:.6f}" for item in value) + "]"

        return process

    def result_processor(
        self,
        _dialect: object,
        _coltype: object,
    ) -> Callable[[object], list[float] | None]:
        def process(value: object) -> list[float] | None:
            if value is None:
                return None
            if isinstance(value, list):
                return [float(item) for item in value]
            if isinstance(value, tuple):
                return [float(item) for item in value]
            if isinstance(value, str):
                vector = value.strip().removeprefix("[").removesuffix("]")
                if not vector:
                    return []
                return [float(item) for item in vector.split(",")]
            return None

        return process


class Base(DeclarativeBase):
    pass


class TimestampedUuidMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class ApplicationStatus(enum.StrEnum):
    SAVED = "saved"
    PREPARING = "preparing"
    APPLIED = "applied"
    ASSESSMENT = "assessment"
    INTERVIEW = "interview"
    REJECTED = "rejected"
    OFFER = "offer"
    ARCHIVED = "archived"


application_status_enum = SAEnum(
    ApplicationStatus,
    name="application_status",
    values_callable=lambda values: [item.value for item in values],
)


class User(TimestampedUuidMixin, Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_email", "email"),)

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    auth_subject: Mapped[str | None] = mapped_column(String(255), unique=True)

    profile: Mapped[Profile | None] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    resumes: Mapped[list[Resume]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    resume_versions: Mapped[list[ResumeVersion]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    projects: Mapped[list[Project]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    github_repositories: Mapped[list[GitHubRepository]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    job_posts: Mapped[list[JobPost]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    company_profiles: Mapped[list[CompanyProfile]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list[Application]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    fit_analyses: Mapped[list[FitAnalysis]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    interview_preps: Mapped[list[InterviewPrep]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    learning_roadmaps: Mapped[list[LearningRoadmap]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    cover_letters: Mapped[list[CoverLetter]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    application_notes: Mapped[list[ApplicationNote]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Profile(TimestampedUuidMixin, Base):
    __tablename__ = "profiles"
    __table_args__ = (Index("ix_profiles_user_id", "user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    headline: Mapped[str | None] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    education_level: Mapped[str | None] = mapped_column(String(120))
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    github_url: Mapped[str | None] = mapped_column(String(2048))
    preferred_location: Mapped[str | None] = mapped_column(String(255))
    internship_type: Mapped[str | None] = mapped_column(String(120))
    languages: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list, nullable=False)
    experience_level: Mapped[str | None] = mapped_column(String(120))
    target_roles: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    user: Mapped[User] = relationship(back_populates="profile")


class Resume(TimestampedUuidMixin, Base):
    __tablename__ = "resumes"
    __table_args__ = (
        Index(
            "ix_resumes_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_where=text("embedding IS NOT NULL"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    embedding_model: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(back_populates="resumes")
    chunks: Mapped[list[ResumeChunk]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
    )
    versions: Mapped[list[ResumeVersion]] = relationship(back_populates="source_resume")


class ResumeChunk(TimestampedUuidMixin, Base):
    __tablename__ = "resume_chunks"
    __table_args__ = (
        UniqueConstraint("resume_id", "chunk_index", name="uq_resume_chunks_resume_index"),
        Index(
            "ix_resume_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_where=text("embedding IS NOT NULL"),
        ),
    )

    resume_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    embedding_model: Mapped[str | None] = mapped_column(String(255))

    resume: Mapped[Resume] = relationship(back_populates="chunks")


class ResumeVersion(TimestampedUuidMixin, Base):
    __tablename__ = "resume_versions"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_resume_versions_user_name"),
        Index("ix_resume_versions_target_role", "target_role"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_resume_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resumes.id", ondelete="SET NULL"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_role: Mapped[str] = mapped_column(String(120), nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="resume_versions")
    source_resume: Mapped[Resume | None] = relationship(back_populates="versions")
    applications: Mapped[list[Application]] = relationship(back_populates="resume_version")


class Project(TimestampedUuidMixin, Base):
    __tablename__ = "projects"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(2048))
    skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    user: Mapped[User] = relationship(back_populates="projects")


class GitHubRepository(TimestampedUuidMixin, Base):
    __tablename__ = "github_repositories"
    __table_args__ = (
        UniqueConstraint("user_id", "full_name", name="uq_github_repositories_user_full_name"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    owner: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(380), index=True, nullable=False)
    html_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(String(120))
    stars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    default_branch: Mapped[str | None] = mapped_column(String(255))
    last_commit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    readme_text: Mapped[str | None] = mapped_column(Text)
    languages: Mapped[dict[str, int]] = mapped_column(JSON, default=dict, nullable=False)
    file_tree: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    deterministic_signals: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    analysis_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    summary_text: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="github_repositories")
    chunks: Mapped[list[GitHubRepositoryChunk]] = relationship(
        back_populates="repository",
        cascade="all, delete-orphan",
    )


class GitHubRepositoryChunk(TimestampedUuidMixin, Base):
    __tablename__ = "github_repository_chunks"
    __table_args__ = (
        UniqueConstraint(
            "repository_id",
            "chunk_index",
            name="uq_github_repository_chunks_repository_index",
        ),
        Index(
            "ix_github_repository_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_where=text("embedding IS NOT NULL"),
        ),
    )

    repository_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("github_repositories.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    embedding_model: Mapped[str | None] = mapped_column(String(255))

    repository: Mapped[GitHubRepository] = relationship(back_populates="chunks")


class Skill(TimestampedUuidMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (Index("ix_skills_name", "name"),)

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(120))


class SkillPrerequisite(TimestampedUuidMixin, Base):
    __tablename__ = "skill_prerequisites"
    __table_args__ = (
        UniqueConstraint(
            "skill_id",
            "prerequisite_skill_id",
            name="uq_skill_prerequisites_edge",
        ),
        CheckConstraint(
            "skill_id <> prerequisite_skill_id",
            name="ck_skill_prerequisites_not_self",
        ),
    )

    skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    prerequisite_skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    skill: Mapped[Skill] = relationship(foreign_keys=[skill_id])
    prerequisite_skill: Mapped[Skill] = relationship(foreign_keys=[prerequisite_skill_id])


class JobPost(TimestampedUuidMixin, Base):
    __tablename__ = "job_posts"
    __table_args__ = (
        Index(
            "ix_job_posts_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_where=text("embedding IS NOT NULL"),
        ),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    company_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(2048))
    source: Mapped[str | None] = mapped_column(String(120))
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    nice_to_have_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    responsibilities: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    seniority_level: Mapped[str | None] = mapped_column(String(120))
    domain: Mapped[str | None] = mapped_column(String(120))
    hidden_expectations: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    english_requirement: Mapped[str | None] = mapped_column(String(120))
    technical_difficulty: Mapped[str | None] = mapped_column(String(120))
    business_expectations: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    communication_expectations: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    analysis_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())
    embedding_model: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User | None] = relationship(back_populates="job_posts")
    applications: Mapped[list[Application]] = relationship(
        back_populates="job_post",
        cascade="all, delete-orphan",
    )
    fit_analyses: Mapped[list[FitAnalysis]] = relationship(
        back_populates="job_post",
        cascade="all, delete-orphan",
    )
    company_profiles: Mapped[list[CompanyProfile]] = relationship(
        back_populates="job_post",
        cascade="all, delete-orphan",
    )
    skill_mappings: Mapped[list[JobSkillMapping]] = relationship(
        back_populates="job_post",
        cascade="all, delete-orphan",
    )


class CompanyProfile(TimestampedUuidMixin, Base):
    __tablename__ = "company_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", "job_post_id", name="uq_company_profiles_user_job_post"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    what_company_does: Mapped[str] = mapped_column(Text, nullable=False)
    likely_interview_angles: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    projects_to_emphasize: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    smart_questions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    user: Mapped[User] = relationship(back_populates="company_profiles")
    job_post: Mapped[JobPost] = relationship(back_populates="company_profiles")


class JobSkillMapping(TimestampedUuidMixin, Base):
    __tablename__ = "job_skill_mappings"
    __table_args__ = (
        UniqueConstraint("job_post_id", "skill_id", name="uq_job_skill_mappings_job_skill"),
    )

    job_post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    required: Mapped[bool] = mapped_column(default=True, nullable=False)
    target_level: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    job_post: Mapped[JobPost] = relationship(back_populates="skill_mappings")
    skill: Mapped[Skill] = relationship()


class Application(TimestampedUuidMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("user_id", "job_post_id", name="uq_applications_user_job_post"),
        Index("ix_applications_status", "status"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    resume_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resume_versions.id", ondelete="SET NULL"),
        index=True,
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        application_status_enum,
        default=ApplicationStatus.SAVED,
        nullable=False,
    )
    deadline: Mapped[date | None] = mapped_column(Date)
    applied_date: Mapped[date | None] = mapped_column(Date)
    interview_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    next_action: Mapped[str | None] = mapped_column(String(500))

    user: Mapped[User] = relationship(back_populates="applications")
    job_post: Mapped[JobPost] = relationship(back_populates="applications")
    resume_version: Mapped[ResumeVersion | None] = relationship(back_populates="applications")
    application_notes: Mapped[list[ApplicationNote]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
    )
    interview_preps: Mapped[list[InterviewPrep]] = relationship(back_populates="application")
    cover_letters: Mapped[list[CoverLetter]] = relationship(back_populates="application")


class FitAnalysis(TimestampedUuidMixin, Base):
    __tablename__ = "fit_analyses"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_score: Mapped[float] = mapped_column(Float, nullable=False)
    project_relevance_score: Mapped[float] = mapped_column(Float, nullable=False)
    experience_score: Mapped[float] = mapped_column(Float, nullable=False)
    education_score: Mapped[float] = mapped_column(Float, nullable=False)
    language_score: Mapped[float] = mapped_column(Float, nullable=False)
    domain_score: Mapped[float] = mapped_column(Float, nullable=False)
    profile_quality_score: Mapped[float] = mapped_column(Float, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    breakdown: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="fit_analyses")
    job_post: Mapped[JobPost] = relationship(back_populates="fit_analyses")
    learning_roadmaps: Mapped[list[LearningRoadmap]] = relationship(back_populates="fit_analysis")


class InterviewPrep(TimestampedUuidMixin, Base):
    __tablename__ = "interview_preps"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("job_posts.id", ondelete="SET NULL"),
        index=True,
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("applications.id", ondelete="SET NULL"),
        index=True,
    )
    focus_areas: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    questions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    user: Mapped[User] = relationship(back_populates="interview_preps")
    job_post: Mapped[JobPost | None] = relationship()
    application: Mapped[Application | None] = relationship(back_populates="interview_preps")


class LearningRoadmap(TimestampedUuidMixin, Base):
    __tablename__ = "learning_roadmaps"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    fit_analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("fit_analyses.id", ondelete="SET NULL"),
        index=True,
    )
    job_post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("job_posts.id", ondelete="SET NULL"),
        index=True,
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("applications.id", ondelete="SET NULL"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    user: Mapped[User] = relationship(back_populates="learning_roadmaps")
    fit_analysis: Mapped[FitAnalysis | None] = relationship(back_populates="learning_roadmaps")
    job_post: Mapped[JobPost | None] = relationship()
    application: Mapped[Application | None] = relationship()


class CoverLetter(TimestampedUuidMixin, Base):
    __tablename__ = "cover_letters"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("job_posts.id", ondelete="SET NULL"),
        index=True,
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("applications.id", ondelete="SET NULL"),
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped[User] = relationship(back_populates="cover_letters")
    job_post: Mapped[JobPost | None] = relationship()
    application: Mapped[Application | None] = relationship(back_populates="cover_letters")


class ApplicationNote(TimestampedUuidMixin, Base):
    __tablename__ = "application_notes"

    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    application: Mapped[Application] = relationship(back_populates="application_notes")
    user: Mapped[User] = relationship(back_populates="application_notes")
