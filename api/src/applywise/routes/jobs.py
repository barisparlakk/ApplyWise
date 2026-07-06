from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.auth import get_current_user
from applywise.database import get_session
from applywise.embeddings import DeterministicEmbeddingProvider
from applywise.fit_score import FitExplanation, compute_and_store_fit_analysis
from applywise.job_analyzer import JobAnalysisError, JobPostAnalysis, analyze_job_post
from applywise.models import FitAnalysis, JobPost, User

router = APIRouter(prefix="/jobs", tags=["jobs"])
current_user_dependency = Depends(get_current_user)
session_dependency = Depends(get_session)
embedding_provider = DeterministicEmbeddingProvider()


class AnalyzeJobPayload(BaseModel):
    content: str = Field(min_length=40)
    source_url: str | None = Field(default=None, max_length=2048)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 40:
            raise ValueError("Job post is too short to analyze.")
        return stripped

    @field_validator("source_url")
    @classmethod
    def strip_source_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class FitAnalysisComponentsResponse(BaseModel):
    skill_score: float
    project_relevance_score: float
    experience_score: float
    education_score: float
    language_score: float
    domain_score: float
    profile_quality_score: float


class FitAnalysisResponse(BaseModel):
    id: uuid.UUID
    components: FitAnalysisComponentsResponse
    total_score: float
    explanation: FitExplanation
    breakdown: dict[str, object]


class JobPostResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    title: str
    description: str
    location: str | None
    url: str | None
    source: str | None
    required_skills: list[str]
    nice_to_have_skills: list[str]
    responsibilities: list[str]
    seniority_level: str | None
    domain: str | None
    hidden_expectations: list[str]
    english_requirement: str | None
    technical_difficulty: str | None
    business_expectations: list[str]
    communication_expectations: list[str]
    analysis: JobPostAnalysis
    fit_analysis: FitAnalysisResponse | None = None


def fit_analysis_to_response(fit_analysis: FitAnalysis | None) -> FitAnalysisResponse | None:
    if fit_analysis is None:
        return None

    explanation = FitExplanation.model_validate(
        (fit_analysis.breakdown or {}).get(
            "explanation",
            {
                "strong_matches": [],
                "weak_areas": [],
                "recommended_action": "Fit explanation is not available yet.",
            },
        )
    )
    return FitAnalysisResponse(
        id=fit_analysis.id,
        components=FitAnalysisComponentsResponse(
            skill_score=fit_analysis.skill_score,
            project_relevance_score=fit_analysis.project_relevance_score,
            experience_score=fit_analysis.experience_score,
            education_score=fit_analysis.education_score,
            language_score=fit_analysis.language_score,
            domain_score=fit_analysis.domain_score,
            profile_quality_score=fit_analysis.profile_quality_score,
        ),
        total_score=fit_analysis.total_score,
        explanation=explanation,
        breakdown=fit_analysis.breakdown or {},
    )


def job_post_to_response(
    job_post: JobPost,
    fit_analysis: FitAnalysis | None = None,
) -> JobPostResponse:
    return JobPostResponse(
        id=job_post.id,
        company_name=job_post.company_name,
        title=job_post.title,
        description=job_post.description,
        location=job_post.location,
        url=job_post.url,
        source=job_post.source,
        required_skills=job_post.required_skills or [],
        nice_to_have_skills=job_post.nice_to_have_skills or [],
        responsibilities=job_post.responsibilities or [],
        seniority_level=job_post.seniority_level,
        domain=job_post.domain,
        hidden_expectations=job_post.hidden_expectations or [],
        english_requirement=job_post.english_requirement,
        technical_difficulty=job_post.technical_difficulty,
        business_expectations=job_post.business_expectations or [],
        communication_expectations=job_post.communication_expectations or [],
        analysis=JobPostAnalysis.model_validate(job_post.analysis_data),
        fit_analysis=fit_analysis_to_response(fit_analysis),
    )


@router.post("/analyze", response_model=JobPostResponse)
def analyze_job(
    payload: AnalyzeJobPayload,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> JobPostResponse:
    try:
        analysis = analyze_job_post(payload.content)
    except JobAnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Job post could not be analyzed.",
        ) from exc

    job_post = JobPost(
        user_id=current_user.id,
        company_name=infer_company_name(payload.content),
        title=analysis.role_title,
        description=payload.content,
        location=infer_location(payload.content),
        url=payload.source_url,
        source="manual",
        required_skills=analysis.required_skills,
        nice_to_have_skills=analysis.nice_to_have_skills,
        responsibilities=analysis.responsibilities,
        seniority_level=analysis.seniority_level,
        domain=analysis.domain,
        hidden_expectations=analysis.hidden_expectations,
        english_requirement=analysis.english_requirement,
        technical_difficulty=analysis.technical_difficulty,
        business_expectations=analysis.business_expectations,
        communication_expectations=analysis.communication_expectations,
        analysis_data=analysis.model_dump(),
        embedding=embedding_provider.embed(payload.content),
    )
    session.add(job_post)
    session.flush()
    fit_analysis = compute_and_store_fit_analysis(session, user=current_user, job_post=job_post)
    session.commit()
    session.refresh(job_post)
    session.refresh(fit_analysis)
    return job_post_to_response(job_post, fit_analysis)


@router.get("/{job_post_id}", response_model=JobPostResponse)
def read_job(
    job_post_id: uuid.UUID,
    current_user: User = current_user_dependency,
    session: Session = session_dependency,
) -> JobPostResponse:
    job_post = session.scalars(
        select(JobPost).where(
            JobPost.id == job_post_id,
            JobPost.user_id == current_user.id,
        )
    ).first()
    if job_post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found.")
    fit_analysis = compute_and_store_fit_analysis(session, user=current_user, job_post=job_post)
    session.commit()
    session.refresh(fit_analysis)
    return job_post_to_response(job_post, fit_analysis)


def infer_company_name(text: str) -> str:
    for line in text.splitlines()[:12]:
        stripped = line.strip()
        lowered = stripped.lower()
        if lowered.startswith(("company:", "company name:", "employer:")):
            return stripped.split(":", maxsplit=1)[1].strip()[:255] or "Unknown company"
    return "Unknown company"


def infer_location(text: str) -> str | None:
    for line in text.splitlines()[:20]:
        stripped = line.strip()
        if stripped.lower().startswith("location:"):
            location = stripped.split(":", maxsplit=1)[1].strip()
            return location[:255] or None
    return None
