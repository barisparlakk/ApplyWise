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
from applywise.embeddings import DeterministicEmbeddingProvider, chunk_text
from applywise.models import Resume, ResumeChunk, User
from applywise.resume_parser import (
    ParsedResume,
    ResumeExtractionError,
    extract_structured_resume,
    parse_cv_file,
)

router = APIRouter(prefix="/resume", tags=["resume"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)
embedding_provider = DeterministicEmbeddingProvider()


class ResumeUploadPayload(BaseModel):
    filename: str = Field(max_length=255)
    content_base64: str

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        filename = value.strip()
        if not filename.lower().endswith((".pdf", ".docx")):
            raise ValueError("Only PDF and DOCX resumes are supported.")
        return filename


class ResumeCorrectionPayload(BaseModel):
    education: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)


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
        return base64.b64decode(payload.content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 resume content.",
        ) from exc


def build_chunks(resume: Resume) -> list[ResumeChunk]:
    chunks = chunk_text(resume.content_text)
    return [
        ResumeChunk(
            resume_id=resume.id,
            chunk_index=index,
            content=chunk,
            embedding=embedding_provider.embed(chunk),
        )
        for index, chunk in enumerate(chunks)
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
) -> ResumeResponse:
    content = decode_upload(payload)
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

    resume = Resume(
        user_id=current_user.id,
        filename=payload.filename,
        content_text=content_text,
        parsed_data=parsed_resume.model_dump(),
        embedding=embedding_provider.embed(content_text),
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
