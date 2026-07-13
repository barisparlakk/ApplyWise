from __future__ import annotations

import base64
import binascii
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.cloudflare_ai import CloudflareAIError
from applywise.database import get_session
from applywise.embedding_tasks import (
    background_jobs_enabled,
    enqueue_resume_embedding,
    update_resume_embeddings,
)
from applywise.embeddings import (
    chunk_text,
    get_embedding_provider,
    safe_embed,
    safe_embed_many,
)
from applywise.models import Resume, ResumeChunk, ResumeVersion, User
from applywise.rate_limit import ai_action_limit_dependency
from applywise.resume_parser import (
    ParsedResume,
    ResumeExtractionError,
    extract_structured_resume,
    parse_cv_file,
)
from applywise.validation import bounded_text_values

router = APIRouter(prefix="/resume", tags=["resume"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)
embedding_provider = get_embedding_provider()
MAX_RESUME_BYTES = 10 * 1024 * 1024
MAX_RESUME_BASE64_LENGTH = ((MAX_RESUME_BYTES + 2) // 3) * 4
RESUME_VERSION_TARGET_ROLES = (
    "AI Intern",
    "Data Science Intern",
    "Backend Intern",
    "Image Processing Intern",
    "Business Analyst Intern",
)


class ResumeUploadPayload(BaseModel):
    filename: str = Field(max_length=255)
    content_base64: str = Field(max_length=MAX_RESUME_BASE64_LENGTH)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        filename = value.strip()
        if not filename.lower().endswith((".pdf", ".docx")):
            raise ValueError("Only PDF and DOCX resumes are supported.")
        return filename


class ResumeCorrectionPayload(BaseModel):
    education: list[str] = Field(default_factory=list, max_length=100)
    experience: list[str] = Field(default_factory=list, max_length=100)
    skills: list[str] = Field(default_factory=list, max_length=100)
    projects: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("education", "experience", "skills", "projects")
    @classmethod
    def validate_sections(cls, value: list[str]) -> list[str]:
        return bounded_text_values(value, max_items=100, max_item_length=2000)


class ResumeResponse(BaseModel):
    id: uuid.UUID
    filename: str
    content_text: str
    parsed_data: ParsedResume
    chunk_count: int


class ResumeVersionCreatePayload(BaseModel):
    source_resume_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    target_role: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Resume version name is required.")
        return stripped

    @field_validator("target_role")
    @classmethod
    def validate_target_role(cls, value: str) -> str:
        stripped = value.strip()
        if stripped not in RESUME_VERSION_TARGET_ROLES:
            raise ValueError("Unsupported resume target role.")
        return stripped


class ResumeVersionUpdatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    target_role: str | None = Field(default=None, min_length=1, max_length=120)
    parsed_data: ResumeCorrectionPayload | None = None

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Resume version name is required.")
        return stripped

    @field_validator("target_role")
    @classmethod
    def validate_optional_target_role(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if stripped not in RESUME_VERSION_TARGET_ROLES:
            raise ValueError("Unsupported resume target role.")
        return stripped


class ResumeVersionResponse(BaseModel):
    id: uuid.UUID
    source_resume_id: uuid.UUID | None
    source_filename: str | None
    name: str
    target_role: str
    content_text: str
    parsed_data: ParsedResume
    selected_application_count: int


def resume_version_to_response(version: ResumeVersion) -> ResumeVersionResponse:
    return ResumeVersionResponse(
        id=version.id,
        source_resume_id=version.source_resume_id,
        source_filename=version.source_resume.filename if version.source_resume else None,
        name=version.name,
        target_role=version.target_role,
        content_text=version.content_text,
        parsed_data=ParsedResume.model_validate(version.parsed_data),
        selected_application_count=len(version.applications),
    )


def resume_to_response(resume: Resume) -> ResumeResponse:
    return ResumeResponse(
        id=resume.id,
        filename=resume.filename,
        content_text=resume.content_text,
        parsed_data=ParsedResume.model_validate(resume.parsed_data),
        chunk_count=len(resume.chunks),
    )


def latest_resume_statement(user: User):
    return (
        select(Resume)
        .where(Resume.user_id == user.id)
        .order_by(Resume.created_at.desc(), Resume.id.desc())
        .limit(1)
    )


def decode_upload(payload: ResumeUploadPayload) -> bytes:
    try:
        content = base64.b64decode(payload.content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 resume content.",
        ) from exc
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume file is empty.",
        )
    if len(content) > MAX_RESUME_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Resume file must be 10 MB or smaller.",
        )
    return content


def build_chunks(resume: Resume, *, defer_embeddings: bool = False) -> list[ResumeChunk]:
    chunks = chunk_text(resume.content_text)
    embeddings = (
        [None] * len(chunks)
        if defer_embeddings
        else safe_embed_many(embedding_provider, chunks)
    )
    return [
        ResumeChunk(
            resume_id=resume.id,
            chunk_index=index,
            content=chunk,
            embedding=embedding,
            embedding_model=embedding_provider.model_name if embedding is not None else None,
        )
        for index, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True))
    ]


@router.get("", response_model=ResumeResponse | None)
def read_resume(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ResumeResponse | None:
    resume = session.scalars(latest_resume_statement(current_user)).first()
    return resume_to_response(resume) if resume else None


@router.post("/upload", response_model=ResumeResponse)
def upload_resume(
    payload: ResumeUploadPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
    _rate_limit: None = ai_action_limit_dependency,
) -> ResumeResponse:
    content = decode_upload(payload)
    lower_filename = payload.filename.lower()
    if lower_filename.endswith(".pdf") and not content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid PDF.",
        )
    if lower_filename.endswith(".docx") and not content.startswith(b"PK"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid DOCX document.",
        )
    try:
        content_text = parse_cv_file(payload.filename, content)
    except ResumeExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if not content_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume text could not be extracted.",
        )

    try:
        parsed_resume = extract_structured_resume(content_text)
    except ResumeExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resume sections could not be extracted.",
        ) from exc

    defer_embeddings = background_jobs_enabled()
    resume_embedding = (
        None if defer_embeddings else safe_embed(embedding_provider, content_text)
    )
    resume = Resume(
        user_id=current_user.id,
        filename=payload.filename,
        content_text=content_text,
        parsed_data=parsed_resume.model_dump(),
        embedding=resume_embedding,
        embedding_model=(
            embedding_provider.model_name if resume_embedding is not None else None
        ),
    )
    session.add(resume)
    session.flush()

    for chunk in build_chunks(resume, defer_embeddings=defer_embeddings):
        session.add(chunk)

    session.commit()
    session.refresh(resume)
    if defer_embeddings and not enqueue_resume_embedding(resume.id):
        try:
            update_resume_embeddings(session, resume.id, provider=embedding_provider)
            session.commit()
            session.refresh(resume)
        except CloudflareAIError:
            session.rollback()
    return resume_to_response(resume)


@router.get("/versions", response_model=list[ResumeVersionResponse])
def list_resume_versions(
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> list[ResumeVersionResponse]:
    versions = session.scalars(
        select(ResumeVersion)
        .where(ResumeVersion.user_id == current_user.id)
        .order_by(ResumeVersion.updated_at.desc(), ResumeVersion.created_at.desc())
    ).all()
    return [resume_version_to_response(version) for version in versions]


@router.post("/versions", response_model=ResumeVersionResponse, status_code=status.HTTP_201_CREATED)
def create_resume_version(
    payload: ResumeVersionCreatePayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ResumeVersionResponse:
    source_resume = (
        session.get(Resume, payload.source_resume_id)
        if payload.source_resume_id is not None
        else session.scalars(latest_resume_statement(current_user)).first()
    )
    if source_resume is None or source_resume.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    existing = session.scalar(
        select(ResumeVersion).where(
            ResumeVersion.user_id == current_user.id,
            ResumeVersion.name == payload.name,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A resume version with this name already exists.",
        )

    version = ResumeVersion(
        user_id=current_user.id,
        source_resume_id=source_resume.id,
        name=payload.name,
        target_role=payload.target_role,
        content_text=source_resume.content_text,
        parsed_data=ParsedResume.model_validate(source_resume.parsed_data).model_dump(),
    )
    session.add(version)
    session.commit()
    session.refresh(version)
    return resume_version_to_response(version)


@router.put("/versions/{version_id}", response_model=ResumeVersionResponse)
def update_resume_version(
    version_id: uuid.UUID,
    payload: ResumeVersionUpdatePayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ResumeVersionResponse:
    version = owned_resume_version(session, current_user, version_id)
    if payload.name is not None and payload.name != version.name:
        duplicate = session.scalar(
            select(ResumeVersion).where(
                ResumeVersion.user_id == current_user.id,
                ResumeVersion.name == payload.name,
                ResumeVersion.id != version.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A resume version with this name already exists.",
            )
        version.name = payload.name
    if payload.target_role is not None:
        version.target_role = payload.target_role
    if payload.parsed_data is not None:
        version.parsed_data = ParsedResume.model_validate(
            payload.parsed_data.model_dump()
        ).model_dump()

    session.commit()
    session.refresh(version)
    return resume_version_to_response(version)


@router.delete("/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume_version(
    version_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> Response:
    version = owned_resume_version(session, current_user, version_id)
    session.delete(version)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def owned_resume_version(
    session: Session,
    user: User,
    version_id: uuid.UUID,
) -> ResumeVersion:
    version = session.scalar(
        select(ResumeVersion).where(
            ResumeVersion.id == version_id,
            ResumeVersion.user_id == user.id,
        )
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume version not found.",
        )
    return version


@router.put("/{resume_id}", response_model=ResumeResponse)
def update_resume_parsed_data(
    resume_id: uuid.UUID,
    payload: ResumeCorrectionPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> ResumeResponse:
    resume = session.get(Resume, resume_id)
    if resume is None or resume.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    parsed_data: dict[str, Any] = ParsedResume.model_validate(payload.model_dump()).model_dump()
    resume.parsed_data = parsed_data
    session.commit()
    session.refresh(resume)
    return resume_to_response(resume)
