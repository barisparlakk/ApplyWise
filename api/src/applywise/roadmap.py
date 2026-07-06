from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.models import Application, FitAnalysis, JobPost, LearningRoadmap, User

SUPPORTED_ROADMAP_DAYS = (3, 7, 14)


class MissingSkill(BaseModel):
    rank: int
    name: str
    impact_score: float
    reason: str

    @field_validator("name", "reason")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class RoadmapDay(BaseModel):
    day: int
    date: date
    focus: str
    tasks: list[str] = Field(default_factory=list)
    outcome: str

    @field_validator("focus", "outcome")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class RoadmapPlan(BaseModel):
    id: uuid.UUID
    title: str
    duration_days: int
    job_post_id: uuid.UUID | None
    application_id: uuid.UUID | None
    fit_analysis_id: uuid.UUID | None
    target_role: str
    missing_skills: list[MissingSkill]
    plan: list[RoadmapDay]


def normalize_roadmap_days(value: int) -> int:
    if value not in SUPPORTED_ROADMAP_DAYS:
        raise ValueError("Roadmap length must be 3, 7, or 14 days.")
    return value


def build_and_store_roadmap(
    session: Session,
    *,
    user: User,
    fit_analysis: FitAnalysis,
    job_post: JobPost,
    duration_days: int = 3,
) -> LearningRoadmap:
    days = normalize_roadmap_days(duration_days)
    application = find_application(session, user=user, job_post=job_post)
    missing_skills = rank_missing_skills(fit_analysis, job_post)
    plan_days = build_dated_plan(
        missing_skills=missing_skills,
        job_post=job_post,
        duration_days=days,
        start_date=datetime.now(UTC).date(),
    )
    roadmap = find_existing_roadmap(
        session,
        user=user,
        fit_analysis=fit_analysis,
        duration_days=days,
    )
    values = {
        "job_post_id": job_post.id,
        "application_id": application.id if application else None,
        "title": f"{days}-day prep plan for {job_post.title}",
        "duration_days": days,
        "items": [
            *[
                {"kind": "missing_skill", **skill.model_dump()}
                for skill in missing_skills
            ],
            *[
                {
                    "kind": "plan_day",
                    **day.model_dump(mode="json"),
                }
                for day in plan_days
            ],
        ],
    }

    if roadmap is None:
        roadmap = LearningRoadmap(
            user_id=user.id,
            fit_analysis_id=fit_analysis.id,
            **values,
        )
        session.add(roadmap)
    else:
        for key, value in values.items():
            setattr(roadmap, key, value)

    session.flush()
    return roadmap


def roadmap_to_plan(roadmap: LearningRoadmap, job_post: JobPost | None = None) -> RoadmapPlan:
    missing_skills = [
        MissingSkill.model_validate(strip_kind(item))
        for item in roadmap.items
        if item.get("kind") == "missing_skill"
    ]
    plan_days = [
        RoadmapDay.model_validate(strip_kind(item))
        for item in roadmap.items
        if item.get("kind") == "plan_day"
    ]
    return RoadmapPlan(
        id=roadmap.id,
        title=roadmap.title,
        duration_days=roadmap.duration_days,
        job_post_id=roadmap.job_post_id,
        application_id=roadmap.application_id,
        fit_analysis_id=roadmap.fit_analysis_id,
        target_role=job_post.title if job_post else "Target role",
        missing_skills=missing_skills,
        plan=plan_days,
    )


def find_existing_roadmap(
    session: Session,
    *,
    user: User,
    fit_analysis: FitAnalysis,
    duration_days: int,
) -> LearningRoadmap | None:
    return session.scalars(
        select(LearningRoadmap)
        .where(
            LearningRoadmap.user_id == user.id,
            LearningRoadmap.fit_analysis_id == fit_analysis.id,
            LearningRoadmap.duration_days == duration_days,
        )
        .order_by(LearningRoadmap.updated_at.desc(), LearningRoadmap.created_at.desc())
        .limit(1)
    ).first()


def find_application(session: Session, *, user: User, job_post: JobPost) -> Application | None:
    return session.scalars(
        select(Application)
        .where(Application.user_id == user.id, Application.job_post_id == job_post.id)
        .order_by(Application.updated_at.desc(), Application.created_at.desc())
        .limit(1)
    ).first()


def rank_missing_skills(fit_analysis: FitAnalysis, job_post: JobPost) -> list[MissingSkill]:
    breakdown = fit_analysis.breakdown or {}
    signals = breakdown.get("signals", {}) if isinstance(breakdown.get("signals"), dict) else {}
    components = (
        breakdown.get("components", {}) if isinstance(breakdown.get("components"), dict) else {}
    )
    required_missing = [
        value for value in signals.get("missing_required_skills", []) if isinstance(value, str)
    ]
    matched_skills = {
        value.lower()
        for value in signals.get("matched_skills", [])
        if isinstance(value, str)
    }
    nice_missing = [
        value
        for value in (job_post.nice_to_have_skills or [])
        if value.lower() not in matched_skills
    ]

    ranked: list[MissingSkill] = []
    for index, skill in enumerate(required_missing):
        ranked.append(
            MissingSkill(
                rank=len(ranked) + 1,
                name=skill,
                impact_score=max(70.0, 100.0 - (index * 8)),
                reason="Required skill missing from the current profile evidence.",
            )
        )

    for index, skill in enumerate(nice_missing):
        ranked.append(
            MissingSkill(
                rank=len(ranked) + 1,
                name=skill,
                impact_score=max(45.0, 65.0 - (index * 5)),
                reason="Nice-to-have skill that can improve role competitiveness.",
            )
        )

    low_component_skills = component_gap_skills(components)
    existing_names = {skill.name.lower() for skill in ranked}
    for skill_name, score, reason in low_component_skills:
        if skill_name.lower() in existing_names:
            continue
        ranked.append(
            MissingSkill(
                rank=len(ranked) + 1,
                name=skill_name,
                impact_score=round(max(40.0, 100.0 - score), 2),
                reason=reason,
            )
        )

    if not ranked:
        ranked.append(
            MissingSkill(
                rank=1,
                name="Interview-ready project narrative",
                impact_score=55.0,
                reason="No major missing technical skill was detected; tighten applied examples.",
            )
        )

    ranked.sort(key=lambda skill: skill.impact_score, reverse=True)
    return [
        skill.model_copy(update={"rank": index + 1})
        for index, skill in enumerate(ranked[:6])
    ]


def component_gap_skills(components: dict[str, Any]) -> list[tuple[str, float, str]]:
    gaps: list[tuple[str, float, str]] = []
    project_score = as_float(components.get("project_relevance_score"), default=100.0)
    domain_score = as_float(components.get("domain_score"), default=100.0)
    language_score = as_float(components.get("language_score"), default=100.0)
    profile_score = as_float(components.get("profile_quality_score"), default=100.0)

    if project_score < 65:
        gaps.append(
            (
                "Role-aligned project proof",
                project_score,
                "Project relevance is low; add a compact project artifact tied to the role.",
            )
        )
    if domain_score < 65:
        gaps.append(
            (
                "Domain fundamentals",
                domain_score,
                "Domain fit is low; review the core concepts and vocabulary for this role.",
            )
        )
    if language_score < 65:
        gaps.append(
            (
                "English interview communication",
                language_score,
                "English requirement is not fully supported by the current profile.",
            )
        )
    if profile_score < 65:
        gaps.append(
            (
                "Profile evidence quality",
                profile_score,
                "Profile quality is low; fill missing proof in profile, CV, or projects.",
            )
        )
    return gaps


def build_dated_plan(
    *,
    missing_skills: list[MissingSkill],
    job_post: JobPost,
    duration_days: int,
    start_date: date,
) -> list[RoadmapDay]:
    skills = missing_skills or [
        MissingSkill(
            rank=1,
            name="Interview-ready project narrative",
            impact_score=50,
            reason="General role preparation.",
        )
    ]
    plan: list[RoadmapDay] = []
    for index in range(duration_days):
        skill = skills[index % len(skills)]
        current_date = start_date + timedelta(days=index)
        plan.append(
            RoadmapDay(
                day=index + 1,
                date=current_date,
                focus=day_focus(index, skill, job_post),
                tasks=day_tasks(index, skill, job_post),
                outcome=day_outcome(index, skill, job_post),
            )
        )
    return plan


def day_focus(index: int, skill: MissingSkill, job_post: JobPost) -> str:
    if index == 0:
        return f"Close the highest-impact gap: {skill.name}"
    if index == 1:
        return f"Apply {skill.name} to a {job_post.title} task"
    if index == 2:
        return f"Turn {skill.name} into interview-ready evidence"
    return f"Deepen {skill.name} for {job_post.title}"


def day_tasks(index: int, skill: MissingSkill, job_post: JobPost) -> list[str]:
    role = job_post.title
    if index % 3 == 0:
        return [
            f"Review one concise tutorial or documentation section for {skill.name}.",
            f"Write 5 bullet notes connecting {skill.name} to {role} responsibilities.",
            "Update your profile or CV with one concrete evidence gap to fill.",
        ]
    if index % 3 == 1:
        return [
            f"Build a 60-90 minute mini exercise using {skill.name}.",
            f"Tie the exercise to this job: {', '.join((job_post.responsibilities or [])[:2])}.",
            "Commit or document the result with a short README-style summary.",
        ]
    return [
        f"Prepare a STAR-style interview story involving {skill.name}.",
        "Practice explaining tradeoffs, failure modes, and what you would improve next.",
        "Add one measurable result or screenshot/link to your application tracker.",
    ]


def day_outcome(index: int, skill: MissingSkill, job_post: JobPost) -> str:
    if index % 3 == 0:
        return f"You can explain why {skill.name} matters for {job_post.title}."
    if index % 3 == 1:
        return f"You have a small artifact proving practical {skill.name} usage."
    return f"You have an interview-ready answer for the {skill.name} gap."


def roadmap_duration_from_query(value: int) -> int:
    try:
        return normalize_roadmap_days(value)
    except ValueError:
        return 3


def strip_kind(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if key != "kind"}


def as_float(value: Any, *, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
