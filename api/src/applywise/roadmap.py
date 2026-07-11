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
    stage = plan_stage(index)
    stage_labels = {
        "learn": "Build the foundation",
        "apply": "Apply it to the role",
        "prove": "Create evidence",
        "explain": "Explain your decisions",
        "simulate": "Practice under interview conditions",
        "refine": "Find and fix weak spots",
        "package": "Package the evidence",
    }
    return f"{stage_labels[stage]}: {skill.name} for {job_post.title}"


def day_tasks(index: int, skill: MissingSkill, job_post: JobPost) -> list[str]:
    stage = plan_stage(index)
    responsibility = job_responsibility(job_post, index)
    practice_task = skill_practice_task(skill.name, job_post)
    advanced_task = (
        "Repeat the exercise with a larger input, an edge case, or less guidance."
        if index >= 7
        else "Keep the exercise small enough to finish and document today."
    )

    if stage == "learn":
        return [
            f"Review the core concepts for {skill.name} and write five role-specific notes.",
            practice_task,
            f"Connect your notes to this responsibility: {responsibility}.",
        ]
    if stage == "apply":
        return [
            practice_task,
            f"Use the result to address this responsibility: {responsibility}.",
            "Record one measurable result and one limitation in a short README.",
        ]
    if stage == "prove":
        return [
            f"Turn the {skill.name} exercise into a reviewable repository, notebook, "
            "or case study.",
            "Add a test, validation check, or before-and-after comparison.",
            f"Write two evidence bullets tied to {responsibility}.",
        ]
    if stage == "explain":
        return [
            f"Record a 90-second explanation of how you used {skill.name}.",
            f"Explain one tradeoff you would make while working on: {responsibility}.",
            "Rewrite the answer once using a clear problem, decision, result structure.",
        ]
    if stage == "simulate":
        return [
            f"Complete a 45-minute timed {skill.name} exercise without tutorial help.",
            practice_task,
            "Score the attempt for correctness, clarity, and communication; list the top two gaps.",
        ]
    if stage == "refine":
        return [
            f"Revisit the weakest part of your {skill.name} evidence and fix one failure mode.",
            advanced_task,
            f"Check that the improved result supports: {responsibility}.",
        ]
    return [
        f"Add the strongest {skill.name} result to the role-specific CV or GitHub summary.",
        f"Write three concise bullets showing how it supports {responsibility}.",
        "Attach the evidence to the application and set the next preparation action.",
    ]


def day_outcome(index: int, skill: MissingSkill, job_post: JobPost) -> str:
    outcomes = {
        "learn": f"You can explain the {skill.name} fundamentals this role uses.",
        "apply": f"You have a role-specific {skill.name} exercise with a measurable result.",
        "prove": f"You have reviewable evidence of practical {skill.name} usage.",
        "explain": f"You have a concise, interview-ready {skill.name} explanation.",
        "simulate": f"You know how your {skill.name} performance holds up under time pressure.",
        "refine": f"Your {skill.name} evidence covers one realistic failure mode.",
        "package": f"Your {skill.name} proof is attached to the {job_post.title} application.",
    }
    return outcomes[plan_stage(index)]


def plan_stage(index: int) -> str:
    stages = ("learn", "apply", "prove", "explain", "simulate", "refine", "package")
    return stages[index % len(stages)]


def job_responsibility(job_post: JobPost, index: int) -> str:
    responsibilities = [value.strip() for value in job_post.responsibilities or [] if value.strip()]
    if responsibilities:
        return responsibilities[index % len(responsibilities)]
    domain = job_post.domain or job_post.title
    return f"deliver a reliable {domain} outcome"


def skill_practice_task(skill_name: str, job_post: JobPost) -> str:
    skill = skill_name.casefold()
    role = job_post.title
    domain = job_post.domain or role

    if any(value in skill for value in ("opencv", "computer vision", "image")):
        return (
            "Build a small image pipeline, choose one evaluation metric, and inspect three "
            "failure cases."
        )
    if any(
        value in skill
        for value in ("machine learning", "deep learning", "pytorch", "tensorflow", "model")
    ):
        return (
            "Train or evaluate a compact baseline, report the metric choice, and explain one "
            "source of model error."
        )
    if any(value in skill for value in ("sql", "postgres", "database", "data model")):
        return (
            "Create a small relational dataset, answer three business questions with SQL, and "
            "inspect one query plan or index choice."
        )
    if any(value in skill for value in ("api", "backend", "fastapi", "django", "spring")):
        return (
            "Implement one validated API endpoint with an error path and an automated test."
        )
    if any(value in skill for value in ("react", "typescript", "javascript", "frontend")):
        return (
            "Build one accessible user workflow with loading, empty, success, and error states."
        )
    if any(value in skill for value in ("docker", "ci", "deployment", "cloud", "kubernetes")):
        return (
            "Package a small service, add a health check, and document one repeatable build or "
            "deployment command."
        )
    if any(value in skill for value in ("excel", "power bi", "tableau", "analyst", "process")):
        return (
            "Analyze a small dataset, define two decision metrics, and present one actionable "
            "recommendation."
        )
    if any(value in skill for value in ("english", "communication", "narrative")):
        return (
            f"Prepare and record a 90-second explanation of a project relevant to {role}."
        )
    if "profile" in skill or "project proof" in skill:
        return (
            "Select one existing project and rewrite its evidence around a concrete "
            f"{role} outcome."
        )
    if "domain" in skill:
        return (
            f"Map five {domain} concepts to the job responsibilities and one existing project."
        )
    return f"Complete a focused {skill_name} exercise using a realistic {domain} scenario."


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
