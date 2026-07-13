from __future__ import annotations

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from applywise.job_ingestion import (
    ImportedJobPost,
    UnsupportedJobSourceError,
    import_job_post,
    parse_job_source_url,
)
from applywise.models import Base, JobPost, User
from applywise.routes.jobs import ImportJobPayload, import_job


def test_greenhouse_import_rebuilds_official_api_url_and_extracts_plain_text() -> None:
    requested_urls: list[str] = []

    def fetch_json(url: str) -> object:
        requested_urls.append(url)
        return {
            "title": "Backend Intern",
            "company_name": "Signal Labs",
            "location": {"name": "Remote"},
            "content": (
                "&lt;p&gt;Build Python and FastAPI services.&lt;/p&gt;"
                "&lt;ul&gt;&lt;li&gt;Use PostgreSQL&lt;/li&gt;&lt;/ul&gt;"
            ),
        }

    imported = import_job_post(
        "https://job-boards.greenhouse.io/signallabs/jobs/123456?gh_src=test",
        fetch_json=fetch_json,
    )

    assert requested_urls == [
        "https://boards-api.greenhouse.io/v1/boards/signallabs/jobs/123456"
    ]
    assert imported.source == "greenhouse"
    assert imported.company_name == "Signal Labs"
    assert imported.location == "Remote"
    assert "Build Python and FastAPI services." in imported.description
    assert "Use PostgreSQL" in imported.description
    assert "<p>" not in imported.description


def test_lever_import_uses_global_and_eu_official_api_hosts() -> None:
    global_reference = parse_job_source_url(
        "https://jobs.lever.co/north-star/12345678-abcd-1234-abcd-123456789012"
    )
    eu_reference = parse_job_source_url(
        "https://jobs.eu.lever.co/north-star/12345678-abcd-1234-abcd-123456789012"
    )

    assert global_reference.api_url.startswith("https://api.lever.co/")
    assert eu_reference.api_url.startswith("https://api.eu.lever.co/")

    imported = import_job_post(
        "https://jobs.lever.co/north-star/12345678-abcd-1234-abcd-123456789012",
        fetch_json=lambda _url: {
            "text": "Data Science Intern",
            "descriptionPlain": "Analyze product data with Python, SQL, and pandas.",
            "categories": {"location": "Istanbul / Hybrid"},
        },
    )
    assert imported.source == "lever"
    assert imported.company_name == "North Star"
    assert imported.title == "Data Science Intern"


@pytest.mark.parametrize(
    "source_url",
    [
        "http://jobs.lever.co/company/12345678-abcd",
        "https://jobs.lever.co.evil.example/company/12345678-abcd",
        "https://127.0.0.1/company/jobs/1234",
        "https://boards.greenhouse.io/company/jobs/not-a-number",
        "https://user@boards.greenhouse.io/company/jobs/1234",
        "https://jobs.lever.co:999999/company/12345678-abcd",
    ],
)
def test_import_rejects_unsupported_or_unsafe_urls_before_fetch(source_url: str) -> None:
    with pytest.raises(UnsupportedJobSourceError):
        parse_job_source_url(source_url)


def test_import_route_analyzes_and_persists_provider_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    source_url = "https://jobs.lever.co/coachlabs/12345678-abcd-1234-abcd-123456789012"
    monkeypatch.setattr(
        "applywise.routes.jobs.import_job_post",
        lambda _url: ImportedJobPost(
            source="lever",
            company_name="Coach Labs",
            title="Backend Intern",
            description=(
                "Build Python and FastAPI services with PostgreSQL. Write tests, use Git, "
                "and communicate implementation tradeoffs in English."
            ),
            location="Remote",
            source_url=source_url,
        ),
    )

    with Session(engine) as session:
        user = User(email="import@example.com")
        session.add(user)
        session.commit()
        session.refresh(user)

        response = import_job(
            ImportJobPayload(source_url=source_url),
            current_user=user,
            session=session,
            _rate_limit=None,
        )
        saved_job = session.scalar(select(JobPost).where(JobPost.id == response.id))

    assert saved_job is not None
    assert saved_job.source == "lever"
    assert saved_job.company_name == "Coach Labs"
    assert saved_job.url == source_url
    assert response.fit_analysis is not None
    assert response.roadmap is not None
