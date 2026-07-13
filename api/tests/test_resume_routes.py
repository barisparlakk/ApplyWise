from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

from docx import Document
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.models import Base, Resume, ResumeChunk, ResumeVersion, User
from applywise.routes.resume import (
    ResumeCorrectionPayload,
    ResumeUploadPayload,
    ResumeVersionCreatePayload,
    ResumeVersionUpdatePayload,
    create_resume_version,
    delete_resume_version,
    list_resume_versions,
    read_resume,
    update_resume_parsed_data,
    update_resume_version,
    upload_resume,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_cv.txt"


def build_docx_fixture() -> bytes:
    document = Document()
    for line in FIXTURE_PATH.read_text().splitlines():
        document.add_paragraph(line)

    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_resume_upload_parse_chunk_embed_and_correct() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="resume@example.com", full_name="Resume User")
        session.add(user)
        session.commit()
        session.refresh(user)

        response = upload_resume(
            ResumeUploadPayload(
                filename="sample_cv.docx",
                content_base64=base64.b64encode(build_docx_fixture()).decode("ascii"),
            ),
            current_user=user,
            session=session,
        )
        corrected_response = update_resume_parsed_data(
            response.id,
            ResumeCorrectionPayload(
                education=["Corrected Education"],
                experience=response.parsed_data.experience,
                skills=["Python", "SQL"],
                projects=response.parsed_data.projects,
            ),
            current_user=user,
            session=session,
        )
        latest_response = read_resume(current_user=user, session=session)
        resume_count = session.scalar(select(func.count()).select_from(Resume))
        chunk_count = session.scalar(select(func.count()).select_from(ResumeChunk))
        saved_resume = session.get(Resume, response.id)
        saved_chunks = session.scalars(
            select(ResumeChunk).where(ResumeChunk.resume_id == response.id)
        ).all()

    assert response.filename == "sample_cv.docx"
    assert "Python" in response.parsed_data.skills
    assert response.chunk_count >= 1
    assert corrected_response.parsed_data.education == ["Corrected Education"]
    assert latest_response is not None
    assert latest_response.parsed_data.skills == ["Python", "SQL"]
    assert resume_count == 1
    assert chunk_count == response.chunk_count
    assert saved_resume is not None
    assert saved_resume.embedding_model == "deterministic-sha256-v1-1536"
    assert all(
        chunk.embedding_model == "deterministic-sha256-v1-1536"
        for chunk in saved_chunks
    )


def test_resume_version_create_update_list_and_delete() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="versions@example.com", full_name="Version User")
        session.add(user)
        session.flush()
        resume = Resume(
            user_id=user.id,
            filename="source.pdf",
            content_text="Python FastAPI backend project",
            parsed_data={
                "education": ["BS Computer Engineering"],
                "experience": ["Backend project"],
                "skills": ["Python", "FastAPI"],
                "projects": ["Application API"],
            },
        )
        session.add(resume)
        session.commit()

        created = create_resume_version(
            ResumeVersionCreatePayload(
                source_resume_id=resume.id,
                name="Backend CV",
                target_role="Backend Intern",
            ),
            current_user=user,
            session=session,
        )
        updated = update_resume_version(
            created.id,
            ResumeVersionUpdatePayload(
                name="Backend Platform CV",
                parsed_data=ResumeCorrectionPayload(
                    education=created.parsed_data.education,
                    experience=["Built and tested a FastAPI service"],
                    skills=["Python", "FastAPI", "PostgreSQL"],
                    projects=created.parsed_data.projects,
                ),
            ),
            current_user=user,
            session=session,
        )
        listed = list_resume_versions(current_user=user, session=session)
        delete_response = delete_resume_version(
            created.id,
            current_user=user,
            session=session,
        )
        remaining = session.scalar(select(func.count()).select_from(ResumeVersion))

    assert created.source_filename == "source.pdf"
    assert updated.name == "Backend Platform CV"
    assert updated.parsed_data.skills == ["Python", "FastAPI", "PostgreSQL"]
    assert len(listed) == 1
    assert listed[0].selected_application_count == 0
    assert delete_response.status_code == 204
    assert remaining == 0
