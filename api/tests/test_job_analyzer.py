from __future__ import annotations

import pytest

from applywise.job_analyzer import JobAnalysisError, JobPostAnalysis, analyze_job_post


class InvalidOnceJobProvider:
    def __init__(self) -> None:
        self.calls = 0

    def analyze_job_json(self, _text: str) -> str:
        self.calls += 1
        if self.calls == 1:
            return "{invalid-json"
        return JobPostAnalysis(
            role_title="AI/ML Intern",
            required_skills=["Python", "SQL"],
            nice_to_have_skills=["Docker"],
            responsibilities=["Build model evaluation tools"],
            seniority_level="Internship",
            domain="AI/ML",
            hidden_expectations=["Learn unfamiliar technical areas quickly"],
            english_requirement="Working proficiency",
            technical_difficulty="Medium",
            business_expectations=["Connect model work to product outcomes"],
            communication_expectations=["Document implementation decisions"],
        ).model_dump_json()


SAMPLE_JOB = """
Company: Wise Labs
Location: Remote
Role: AI/ML Intern

Responsibilities
- Build Python services for RAG evaluation
- Analyze model quality with SQL and dashboards
- Collaborate with product stakeholders

Requirements
- Python
- SQL
- Machine Learning
- REST APIs
- English communication

Nice to have
- Docker
- FastAPI
"""


def test_job_analyzer_extracts_structured_breakdown() -> None:
    analysis = analyze_job_post(SAMPLE_JOB)

    assert analysis.role_title == "AI/ML Intern"
    assert "Python" in analysis.required_skills
    assert "SQL" in analysis.required_skills
    assert "Docker" in analysis.nice_to_have_skills
    assert analysis.seniority_level == "Internship"
    assert analysis.domain == "AI/ML"
    assert analysis.english_requirement == "Working proficiency"
    assert analysis.technical_difficulty in {"Medium", "High"}
    assert analysis.business_expectations
    assert analysis.communication_expectations


def test_job_analyzer_retries_invalid_structured_output() -> None:
    provider = InvalidOnceJobProvider()

    analysis = analyze_job_post(SAMPLE_JOB, provider=provider)

    assert provider.calls == 2
    assert analysis.role_title == "AI/ML Intern"
    assert analysis.required_skills == ["Python", "SQL"]


def test_job_analyzer_fails_after_invalid_output() -> None:
    class AlwaysInvalidProvider:
        def analyze_job_json(self, _text: str) -> str:
            return "{invalid-json"

    with pytest.raises(JobAnalysisError):
        analyze_job_post(SAMPLE_JOB, provider=AlwaysInvalidProvider())
