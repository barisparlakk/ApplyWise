from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

from docx import Document
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from applywise.models import Base, Resume, ResumeChunk, User
from applywise.routes.resume import (
    ResumeCorrectionPayload,
    ResumeUploadPayload,
    read_resume,
    update_resume_parsed_data,
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

    assert response.filename == "sample_cv.docx"
    assert "Python" in response.parsed_data.skills
    assert response.chunk_count >= 1
    assert corrected_response.parsed_data.education == ["Corrected Education"]
    assert latest_response is not None
    assert latest_response.parsed_data.skills == ["Python", "SQL"]
    assert resume_count == 1
    assert chunk_count == response.chunk_count
