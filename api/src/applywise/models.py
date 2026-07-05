from __future__ import annotations

import enum
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
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


class Base(DeclarativeBase):
    pass


class TimestampedUuidMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)


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

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
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
    projects: Mapped[list[Project]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    github_repositories: Mapped[list[GitHubRepository]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    job_posts: Mapped[list[JobPost]] = relationship(back_populates="user")
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

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
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

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())

    user: Mapped[User] = relationship(back_populates="resumes")
    chunks: Mapped[list[ResumeChunk]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
    )


class ResumeChunk(TimestampedUuidMixin, Base):
    __tablename__ = "resume_chunks"
    __table_args__ = (
        UniqueConstraint("resume_id", "chunk_index", name="uq_resume_chunks_resume_index"),
    )

    resume_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resumes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())

    resume: Mapped[Resume] = relationship(back_populates="chunks")


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
    )

    repository_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("github_repositories.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())

    repository: Mapped[GitHubRepository] = relationship(back_populates="chunks")


class Skill(TimestampedUuidMixin, Base):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String(120))


class JobPost(TimestampedUuidMixin, Base):
    __tablename__ = "job_posts"

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
    embedding: Mapped[list[float] | None] = mapped_column(Vector())

    user: Mapped[User | None] = relationship(back_populates="job_posts")
    applications: Mapped[list[Application]] = relationship(
        back_populates="job_post",
        cascade="all, delete-orphan",
    )
    fit_analyses: Mapped[list[FitAnalysis]] = relationship(
        back_populates="job_post",
        cascade="all, delete-orphan",
    )


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
    status: Mapped[ApplicationStatus] = mapped_column(
        application_status_enum,
        default=ApplicationStatus.SAVED,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="applications")
    job_post: Mapped[JobPost] = relationship(back_populates="applications")
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
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)

    user: Mapped[User] = relationship(back_populates="learning_roadmaps")
    fit_analysis: Mapped[FitAnalysis | None] = relationship(back_populates="learning_roadmaps")


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
