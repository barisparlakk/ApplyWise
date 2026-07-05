from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from docx import Document

from applywise.resume_parser import (
    ParsedResume,
    ResumeExtractionError,
    extract_structured_resume,
    parse_cv_file,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_cv.txt"


class InvalidOnceProvider:
    def __init__(self, valid_payload: str) -> None:
        self.calls = 0
        self.valid_payload = valid_payload

    def extract_resume_json(self, _text: str) -> str:
        self.calls += 1
        if self.calls == 1:
            return "{invalid-json"
        return self.valid_payload


def build_docx_fixture(text: str) -> bytes:
    document = Document()
    for line in text.splitlines():
        document.add_paragraph(line)

    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_docx_parser_extracts_structured_resume_from_sample_cv_fixture() -> None:
    fixture_text = FIXTURE_PATH.read_text()
    docx_content = build_docx_fixture(fixture_text)

    extracted_text = parse_cv_file("sample_cv.docx", docx_content)
    parsed_resume = extract_structured_resume(extracted_text)

    assert "ApplyWise University" in parsed_resume.education[0]
    assert "Data Science Intern" in parsed_resume.experience[0]
    assert "Python" in parsed_resume.skills
    assert "Internship Fit Analyzer" in parsed_resume.projects[0]


def test_structured_resume_extraction_retries_invalid_provider_output() -> None:
    provider = InvalidOnceProvider(
        ParsedResume(
            education=["BS Computer Engineering"],
            experience=["Backend Intern"],
            skills=["Python"],
            projects=["API"],
        ).model_dump_json()
    )

    parsed_resume = extract_structured_resume("Education\nBS Computer Engineering", provider)

    assert provider.calls == 2
    assert parsed_resume.skills == ["Python"]


def test_parser_rejects_unsupported_file_type() -> None:
    with pytest.raises(ResumeExtractionError):
        parse_cv_file("resume.txt", b"Education\nComputer Engineering")
