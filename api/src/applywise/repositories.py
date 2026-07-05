from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.models import (
    Application,
    ApplicationNote,
    Base,
    CoverLetter,
    FitAnalysis,
    GitHubRepository,
    GitHubRepositoryChunk,
    InterviewPrep,
    JobPost,
    LearningRoadmap,
    Profile,
    Project,
    Resume,
    ResumeChunk,
    Skill,
    User,
)

ModelT = TypeVar("ModelT", bound=Base)


class Repository(Generic[ModelT]):
    def __init__(self, session: Session, model: type[ModelT]) -> None:
        self.session = session
        self.model = model

    def create(self, **values: Any) -> ModelT:
        instance = self.model(**values)
        self.session.add(instance)
        self.session.flush()
        return instance

    def get(self, model_id: uuid.UUID) -> ModelT | None:
        return self.session.get(self.model, model_id)

    def list(self, *, limit: int = 100, offset: int = 0) -> Sequence[ModelT]:
        statement = select(self.model).offset(offset).limit(limit)
        return self.session.scalars(statement).all()

    def update(self, instance: ModelT, **values: Any) -> ModelT:
        for key, value in values.items():
            setattr(instance, key, value)
        self.session.flush()
        return instance

    def delete(self, instance: ModelT) -> None:
        self.session.delete(instance)
        self.session.flush()


class Repositories:
    def __init__(self, session: Session) -> None:
        self.users = Repository[User](session, User)
        self.profiles = Repository[Profile](session, Profile)
        self.resumes = Repository[Resume](session, Resume)
        self.resume_chunks = Repository[ResumeChunk](session, ResumeChunk)
        self.projects = Repository[Project](session, Project)
        self.github_repositories = Repository[GitHubRepository](session, GitHubRepository)
        self.github_repository_chunks = Repository[GitHubRepositoryChunk](
            session,
            GitHubRepositoryChunk,
        )
        self.skills = Repository[Skill](session, Skill)
        self.job_posts = Repository[JobPost](session, JobPost)
        self.applications = Repository[Application](session, Application)
        self.fit_analyses = Repository[FitAnalysis](session, FitAnalysis)
        self.interview_preps = Repository[InterviewPrep](session, InterviewPrep)
        self.learning_roadmaps = Repository[LearningRoadmap](session, LearningRoadmap)
        self.cover_letters = Repository[CoverLetter](session, CoverLetter)
        self.application_notes = Repository[ApplicationNote](session, ApplicationNote)
