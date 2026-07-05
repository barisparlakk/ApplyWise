from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import AuthContext, get_current_auth, get_current_user
from applywise.database import get_session
from applywise.embeddings import DeterministicEmbeddingProvider, chunk_text
from applywise.github_analyzer import (
    GitHubAnalysisError,
    GitHubDeterministicSignals,
    GitHubRepositoryAnalysis,
    GitHubRepositoryAnalysisResult,
    GitHubRequestError,
    analyze_github_repository_url,
)
from applywise.models import GitHubRepository, GitHubRepositoryChunk, User

router = APIRouter(prefix="/github/repositories", tags=["github"])
current_auth_dependency = Depends(get_current_auth)
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)
embedding_provider = DeterministicEmbeddingProvider()


class AnalyzeGitHubRepositoryPayload(BaseModel):
    repo_url: str = Field(max_length=2048)


class GitHubRepositoryResponse(BaseModel):
    id: uuid.UUID
    owner: str
    name: str
    full_name: str
    html_url: str
    description: str | None
    language: str | None
    stars: int
    default_branch: str | None
    last_commit_at: str | None
    languages: dict[str, int]
    deterministic_signals: GitHubDeterministicSignals
    analysis: GitHubRepositoryAnalysis
    summary_text: str | None
    chunk_count: int


def repository_to_response(repository: GitHubRepository) -> GitHubRepositoryResponse:
    signals = (
        GitHubDeterministicSignals.model_validate(repository.deterministic_signals)
        if repository.deterministic_signals
        else GitHubDeterministicSignals(
            readme_length=len(repository.readme_text or ""),
            has_tests=False,
            has_docker=False,
            has_ci=False,
            has_docs=bool(repository.readme_text),
            has_deployment_config=False,
            file_count=len(repository.file_tree or []),
            directory_count=0,
            language_count=len(repository.languages or {}),
            top_level_directories=[],
        )
    )
    analysis = (
        GitHubRepositoryAnalysis.model_validate(repository.analysis_data)
        if repository.analysis_data
        else GitHubRepositoryAnalysis(
            readme_quality="Unknown",
            tech_stack=[],
            complexity="Unknown",
            commit_activity="Unknown",
            testing="Unknown",
            deployment="Unknown",
            architecture_signals=[],
            missing_documentation=[],
            best_fit_roles=[],
            strengths=[],
            weaknesses=[],
            recommendations=[],
        )
    )
    return GitHubRepositoryResponse(
        id=repository.id,
        owner=repository.owner,
        name=repository.name,
        full_name=repository.full_name,
        html_url=repository.html_url,
        description=repository.description,
        language=repository.language,
        stars=repository.stars,
        default_branch=repository.default_branch,
        last_commit_at=repository.last_commit_at.isoformat() if repository.last_commit_at else None,
        languages=repository.languages or {},
        deterministic_signals=signals,
        analysis=analysis,
        summary_text=repository.summary_text,
        chunk_count=len(repository.chunks),
    )


@router.get("", response_model=list[GitHubRepositoryResponse])
def list_repositories(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> list[GitHubRepositoryResponse]:
    repositories = session.scalars(
        select(GitHubRepository)
        .where(GitHubRepository.user_id == current_user.id)
        .order_by(GitHubRepository.updated_at.desc(), GitHubRepository.created_at.desc())
    ).all()
    return [repository_to_response(repository) for repository in repositories]


@router.post("/analyze", response_model=GitHubRepositoryResponse)
def analyze_repository(
    payload: AnalyzeGitHubRepositoryPayload,
    current_auth: AuthContext = current_auth_dependency,
    session: Session = session_dependency,
) -> GitHubRepositoryResponse:
    try:
        result = analyze_github_repository_url(
            payload.repo_url,
            github_token=current_auth.claims.github_access_token,
        )
    except GitHubRequestError as exc:
        raise HTTPException(
            status_code=github_status_code_to_http(exc.status_code),
            detail=str(exc),
        ) from exc
    except GitHubAnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    repository = upsert_analyzed_repository(session, current_auth.user, result)
    session.commit()
    session.refresh(repository)
    return repository_to_response(repository)


def upsert_analyzed_repository(
    session: Session,
    user: User,
    result: GitHubRepositoryAnalysisResult,
) -> GitHubRepository:
    fetched = result.repository
    repository = session.scalars(
        select(GitHubRepository).where(
            GitHubRepository.user_id == user.id,
            GitHubRepository.full_name == fetched.full_name,
        )
    ).first()

    values = {
        "owner": fetched.owner,
        "name": fetched.name,
        "full_name": fetched.full_name,
        "html_url": fetched.html_url,
        "description": fetched.description,
        "language": fetched.language,
        "stars": fetched.stars,
        "default_branch": fetched.default_branch,
        "last_commit_at": fetched.last_commit_at,
        "readme_text": fetched.readme_text,
        "languages": fetched.languages,
        "file_tree": fetched.file_paths,
        "deterministic_signals": result.signals.model_dump(mode="json"),
        "analysis_data": result.analysis.model_dump(mode="json"),
        "summary_text": result.summary_text,
    }

    if repository is None:
        repository = GitHubRepository(user_id=user.id, **values)
        session.add(repository)
    else:
        for key, value in values.items():
            setattr(repository, key, value)

    session.flush()
    rebuild_summary_chunks(session, repository, result.summary_text)
    return repository


def rebuild_summary_chunks(
    session: Session,
    repository: GitHubRepository,
    summary_text: str,
) -> None:
    for chunk in list(repository.chunks):
        session.delete(chunk)
    session.flush()

    for index, chunk in enumerate(chunk_text(summary_text)):
        session.add(
            GitHubRepositoryChunk(
                repository_id=repository.id,
                chunk_index=index,
                content=chunk,
                embedding=embedding_provider.embed(chunk),
            )
        )


def github_status_code_to_http(status_code: int) -> int:
    if status_code in {401, 403, 404}:
        return status_code
    return status.HTTP_502_BAD_GATEWAY
