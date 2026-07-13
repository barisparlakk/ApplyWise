from __future__ import annotations

import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.embedding_tasks import (
    enqueue_embedding_actor,
    parse_entity_id,
    update_job_embedding,
    update_repository_embeddings,
    update_resume_embeddings,
)
from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.models import (
    Base,
    GitHubRepository,
    GitHubRepositoryChunk,
    JobPost,
    Resume,
    ResumeChunk,
    User,
)


class FakeActor:
    def __init__(self) -> None:
        self.messages: list[str] = []

    def send(self, entity_id: str) -> None:
        self.messages.append(entity_id)


def test_embedding_jobs_refresh_resume_repository_and_job_vectors() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    provider = DeterministicEmbeddingProvider(dimensions=8)

    with Session(engine) as session:
        user = User(email="jobs@example.com")
        session.add(user)
        session.flush()
        resume = Resume(
            user_id=user.id,
            filename="resume.pdf",
            content_text="Python backend systems",
            parsed_data={},
        )
        repository = GitHubRepository(
            user_id=user.id,
            owner="student",
            name="backend",
            full_name="student/backend",
            html_url="https://github.com/student/backend",
        )
        job_post = JobPost(
            user_id=user.id,
            company_name="Northstar",
            title="Backend Intern",
            description="Build Python APIs",
        )
        session.add_all([resume, repository, job_post])
        session.flush()
        resume_chunk = ResumeChunk(
            resume_id=resume.id,
            chunk_index=0,
            content="FastAPI and PostgreSQL",
        )
        repository_chunk = GitHubRepositoryChunk(
            repository_id=repository.id,
            chunk_index=0,
            content="Tested API service",
        )
        session.add_all([resume_chunk, repository_chunk])
        session.flush()

        assert update_resume_embeddings(session, resume.id, provider=provider) is True
        assert update_repository_embeddings(session, repository.id, provider=provider) is True
        assert update_job_embedding(session, job_post.id, provider=provider) is True

        assert resume.embedding is not None and len(resume.embedding) == 8
        assert resume_chunk.embedding is not None and len(resume_chunk.embedding) == 8
        assert repository_chunk.embedding is not None and len(repository_chunk.embedding) == 8
        assert job_post.embedding is not None and len(job_post.embedding) == 8
        assert resume.embedding_model == provider.model_name
        assert resume_chunk.embedding_model == provider.model_name
        assert repository_chunk.embedding_model == provider.model_name
        assert job_post.embedding_model == provider.model_name


def test_enqueue_respects_background_jobs_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    actor = FakeActor()
    entity_id = uuid.uuid4()
    monkeypatch.setenv("BACKGROUND_JOBS_ENABLED", "false")

    assert enqueue_embedding_actor(actor, entity_id) is False
    assert actor.messages == []

    monkeypatch.setenv("BACKGROUND_JOBS_ENABLED", "true")
    assert enqueue_embedding_actor(actor, entity_id) is True
    assert actor.messages == [str(entity_id)]


def test_background_job_rejects_invalid_entity_id() -> None:
    with pytest.raises(ValueError, match="invalid entity ID"):
        parse_entity_id("not-a-uuid")
