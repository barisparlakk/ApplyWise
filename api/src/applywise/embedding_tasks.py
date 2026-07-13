from __future__ import annotations

import logging
import os
import uuid
from typing import Protocol

import dramatiq
from dramatiq.brokers.redis import RedisBroker
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.database import SessionLocal
from applywise.embeddings import EmbeddingProvider, get_embedding_provider
from applywise.environment import boolean_environment
from applywise.models import (
    GitHubRepository,
    GitHubRepositoryChunk,
    JobPost,
    Resume,
    ResumeChunk,
)

EMBEDDING_QUEUE = "embeddings"
logger = logging.getLogger(__name__)
redis_broker = RedisBroker(
    url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    namespace="applywise",
)
dramatiq.set_broker(redis_broker)


class ActorSender(Protocol):
    def send(self, entity_id: str) -> object: ...


def background_jobs_enabled() -> bool:
    return boolean_environment("BACKGROUND_JOBS_ENABLED", False)


def enqueue_resume_embedding(resume_id: uuid.UUID) -> bool:
    return enqueue_embedding_actor(refresh_resume_embeddings, resume_id)


def enqueue_repository_embedding(repository_id: uuid.UUID) -> bool:
    return enqueue_embedding_actor(refresh_repository_embeddings, repository_id)


def enqueue_job_embedding(job_post_id: uuid.UUID) -> bool:
    return enqueue_embedding_actor(refresh_job_embedding, job_post_id)


def enqueue_embedding_actor(actor: ActorSender, entity_id: uuid.UUID) -> bool:
    if not background_jobs_enabled():
        return False
    try:
        actor.send(str(entity_id))
    except RedisError:
        logger.warning(
            "Embedding job enqueue failed for %s; request fallback will run if available.",
            entity_id,
            exc_info=True,
        )
        return False
    return True


@dramatiq.actor(
    actor_name="refresh_resume_embeddings",
    queue_name=EMBEDDING_QUEUE,
    max_retries=2,
    min_backoff=60_000,
    throws=(ValueError,),
)
def refresh_resume_embeddings(resume_id: str) -> None:
    parsed_id = parse_entity_id(resume_id)
    with SessionLocal() as session:
        update_resume_embeddings(session, parsed_id)
        session.commit()


@dramatiq.actor(
    actor_name="refresh_repository_embeddings",
    queue_name=EMBEDDING_QUEUE,
    max_retries=2,
    min_backoff=60_000,
    throws=(ValueError,),
)
def refresh_repository_embeddings(repository_id: str) -> None:
    parsed_id = parse_entity_id(repository_id)
    with SessionLocal() as session:
        update_repository_embeddings(session, parsed_id)
        session.commit()


@dramatiq.actor(
    actor_name="refresh_job_embedding",
    queue_name=EMBEDDING_QUEUE,
    max_retries=2,
    min_backoff=60_000,
    throws=(ValueError,),
)
def refresh_job_embedding(job_post_id: str) -> None:
    parsed_id = parse_entity_id(job_post_id)
    with SessionLocal() as session:
        update_job_embedding(session, parsed_id)
        session.commit()


def update_resume_embeddings(
    session: Session,
    resume_id: uuid.UUID,
    *,
    provider: EmbeddingProvider | None = None,
) -> bool:
    resume = session.get(Resume, resume_id)
    if resume is None:
        return False
    chunks = list(
        session.scalars(
            select(ResumeChunk)
            .where(ResumeChunk.resume_id == resume.id)
            .order_by(ResumeChunk.chunk_index)
        ).all()
    )
    selected_provider = provider or get_embedding_provider()
    vectors = selected_provider.embed_many(
        [resume.content_text, *(chunk.content for chunk in chunks)]
    )
    if len(vectors) != len(chunks) + 1:
        raise RuntimeError("Embedding provider returned the wrong vector count.")
    resume.embedding = vectors[0]
    resume.embedding_model = selected_provider.model_name
    for chunk, vector in zip(chunks, vectors[1:], strict=True):
        chunk.embedding = vector
        chunk.embedding_model = selected_provider.model_name
    session.flush()
    return True


def update_repository_embeddings(
    session: Session,
    repository_id: uuid.UUID,
    *,
    provider: EmbeddingProvider | None = None,
) -> bool:
    repository = session.get(GitHubRepository, repository_id)
    if repository is None:
        return False
    chunks = list(
        session.scalars(
            select(GitHubRepositoryChunk)
            .where(GitHubRepositoryChunk.repository_id == repository.id)
            .order_by(GitHubRepositoryChunk.chunk_index)
        ).all()
    )
    if not chunks:
        return True
    selected_provider = provider or get_embedding_provider()
    vectors = selected_provider.embed_many([chunk.content for chunk in chunks])
    if len(vectors) != len(chunks):
        raise RuntimeError("Embedding provider returned the wrong vector count.")
    for chunk, vector in zip(chunks, vectors, strict=True):
        chunk.embedding = vector
        chunk.embedding_model = selected_provider.model_name
    session.flush()
    return True


def update_job_embedding(
    session: Session,
    job_post_id: uuid.UUID,
    *,
    provider: EmbeddingProvider | None = None,
) -> bool:
    job_post = session.get(JobPost, job_post_id)
    if job_post is None:
        return False
    selected_provider = provider or get_embedding_provider()
    job_post.embedding = selected_provider.embed(job_post.description)
    job_post.embedding_model = selected_provider.model_name
    session.flush()
    return True


def parse_entity_id(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise ValueError("Background job received an invalid entity ID.") from exc
