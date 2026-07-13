from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from docx import Document

import applywise.resume_parser as resume_parser
from applywise.resume_parser import (
    ParsedResume,
    ResumeExtractionError,
    extract_structured_resume,
    parse_cv_file,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_cv.txt"
REALISTIC_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "realistic_cv.txt"


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


def test_parser_handles_aliases_inline_headings_and_table_style_rows() -> None:
    fixture_text = REALISTIC_FIXTURE_PATH.read_text()
    parsed_resume = extract_structured_resume(fixture_text)

    assert parsed_resume.education == [
        "BSc Computer Engineering, ApplyWise University, 2023-2027"
    ]
    assert "backend engineering intern" in parsed_resume.experience[0].casefold()
    assert parsed_resume.skills == [
        "Python",
        "FastAPI",
        "SQL",
        "PostgreSQL",
        "Docker",
        "GitHub Actions",
    ]
    assert len(parsed_resume.projects) == 2
    assert all("CERTIFICATIONS" not in value for value in parsed_resume.projects)


def test_parser_rejects_unsupported_file_type() -> None:
    with pytest.raises(ResumeExtractionError):
        parse_cv_file("resume.txt", b"Education\nComputer Engineering")


def test_docx_parser_rejects_oversized_expanded_archive(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(resume_parser, "MAX_DOCX_UNCOMPRESSED_BYTES", 100)
    docx_content = build_docx_fixture("Education\n" + ("Computer Engineering " * 20))

    with pytest.raises(ResumeExtractionError, match="expands beyond"):
        parse_cv_file("oversized.docx", docx_content)


def test_docx_parser_rejects_unbounded_extracted_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    docx_content = build_docx_fixture("Education\nComputer Engineering")
    monkeypatch.setattr(resume_parser, "MAX_EXTRACTED_TEXT_CHARS", 10)

    with pytest.raises(ResumeExtractionError, match="text exceeds"):
        parse_cv_file("long-text.docx", docx_content)
