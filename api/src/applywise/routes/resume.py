from __future__ import annotations

import base64
import binascii
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.embeddings import (
    chunk_text,
    get_embedding_provider,
    safe_embed,
    safe_embed_many,
)
from applywise.models import Resume, ResumeChunk, User
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


def build_chunks(resume: Resume) -> list[ResumeChunk]:
    chunks = chunk_text(resume.content_text)
    embeddings = safe_embed_many(embedding_provider, chunks)
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

    resume_embedding = safe_embed(embedding_provider, content_text)
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

    for chunk in build_chunks(resume):
        session.add(chunk)

    session.commit()
    session.refresh(resume)
    return resume_to_response(resume)


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
