from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from applywise.fit_score import FIT_SCORE_WEIGHTS
from applywise.models import FitAnalysis, JobPost

CoachDecision = Literal["apply_now", "apply_after_targeted_fix", "build_evidence_first"]
CoachActionCode = Literal[
    "prove_missing_skill",
    "strengthen_project",
    "quantify_experience",
    "clarify_education",
    "document_language",
    "align_domain",
    "complete_profile",
    "maintain_evidence",
]
CoachComponent = Literal[
    "skill_score",
    "project_relevance_score",
    "experience_score",
    "education_score",
    "language_score",
    "domain_score",
    "profile_quality_score",
]


class ApplicationCoachResponse(BaseModel):
    job_post_id: uuid.UUID
    decision: CoachDecision
    should_apply_now: bool
    current_fit_score: float = Field(ge=0, le=100)
    projected_fit_score: float = Field(ge=0, le=100)
    focus_component: CoachComponent
    focus_component_label: str
    current_component_score: float = Field(ge=0, le=100)
    component_weight: float = Field(gt=0, le=1)
    scenario_component_uplift: float = Field(ge=0, le=100)
    estimated_point_improvement: float = Field(ge=0, le=100)
    action_code: CoachActionCode
    action_subject: str
    highest_leverage_fix: str
    decision_reason: str
    estimate_basis: Literal["deterministic_one_fix_scenario"] = (
        "deterministic_one_fix_scenario"
    )


@dataclass(frozen=True)
class ComponentOpportunity:
    field: CoachComponent
    label: str
    maximum_uplift: float


# Each cap represents one concrete profile or evidence improvement, not a promise that
# a user can reach 100 in a single action. The weighted gain is always recomputed here.
COMPONENT_OPPORTUNITIES = (
    ComponentOpportunity("skill_score", "Skill match", 20.0),
    ComponentOpportunity("project_relevance_score", "Project relevance", 25.0),
    ComponentOpportunity("experience_score", "Experience", 20.0),
    ComponentOpportunity("education_score", "Education", 15.0),
    ComponentOpportunity("language_score", "Language", 20.0),
    ComponentOpportunity("domain_score", "Domain", 20.0),
    ComponentOpportunity("profile_quality_score", "Profile quality", 20.0),
)


def build_application_coach(
    *,
    fit_analysis: FitAnalysis,
    job_post: JobPost,
) -> ApplicationCoachResponse:
    ranked_opportunities = sorted(
        (
            (
                round(
                    min(opportunity.maximum_uplift, 100.0 - component_score)
                    * FIT_SCORE_WEIGHTS[opportunity.field],
                    2,
                ),
                opportunity,
                component_score,
            )
            for opportunity in COMPONENT_OPPORTUNITIES
            for component_score in [float(getattr(fit_analysis, opportunity.field))]
        ),
        key=lambda item: item[0],
        reverse=True,
    )
    estimated_gain, opportunity, component_score = ranked_opportunities[0]
    component_uplift = round(
        min(opportunity.maximum_uplift, 100.0 - component_score),
        2,
    )
    action_code, action_subject, action = action_for_opportunity(
        opportunity.field,
        fit_analysis=fit_analysis,
        job_post=job_post,
    )
    if estimated_gain <= 0:
        action_code = "maintain_evidence"
        action_subject = job_post.title
        action = "Keep your role evidence current and tailor it before submitting."

    current_fit = round(float(fit_analysis.total_score), 2)
    decision = decision_for_score(current_fit)
    return ApplicationCoachResponse(
        job_post_id=job_post.id,
        decision=decision,
        should_apply_now=decision == "apply_now",
        current_fit_score=current_fit,
        projected_fit_score=round(min(100.0, current_fit + estimated_gain), 2),
        focus_component=opportunity.field,
        focus_component_label=opportunity.label,
        current_component_score=round(component_score, 2),
        component_weight=FIT_SCORE_WEIGHTS[opportunity.field],
        scenario_component_uplift=component_uplift,
        estimated_point_improvement=estimated_gain,
        action_code=action_code,
        action_subject=action_subject,
        highest_leverage_fix=action,
        decision_reason=decision_reason(decision, current_fit),
    )


def decision_for_score(score: float) -> CoachDecision:
    if score >= 75:
        return "apply_now"
    if score >= 55:
        return "apply_after_targeted_fix"
    return "build_evidence_first"


def action_for_opportunity(
    component: CoachComponent,
    *,
    fit_analysis: FitAnalysis,
    job_post: JobPost,
) -> tuple[CoachActionCode, str, str]:
    signals = (fit_analysis.breakdown or {}).get("signals", {})
    missing_skills = signals.get("missing_required_skills", []) if isinstance(signals, dict) else []
    missing_skill = next((str(skill) for skill in missing_skills if str(skill).strip()), "")
    domain = (job_post.domain or job_post.title).strip()

    if component == "skill_score":
        subject = missing_skill or (job_post.required_skills or [job_post.title])[0]
        return (
            "prove_missing_skill",
            subject,
            f"Build and verify {subject} evidence in one project, then add it to your CV.",
        )
    if component == "project_relevance_score":
        return (
            "strengthen_project",
            domain,
            f"Add a measurable {domain} result and implementation evidence to your "
            "strongest project.",
        )
    if component == "experience_score":
        return (
            "quantify_experience",
            job_post.title,
            "Rewrite one relevant project or internship bullet with scope, action, and a "
            "measurable result.",
        )
    if component == "education_score":
        return (
            "clarify_education",
            domain,
            f"Add degree and coursework evidence that is relevant to {domain}.",
        )
    if component == "language_score":
        return (
            "document_language",
            job_post.english_requirement or "English",
            "Document your verified English level and rehearse a role-specific introduction.",
        )
    if component == "domain_score":
        return (
            "align_domain",
            domain,
            f"Make the {domain} connection explicit in your strongest project summary.",
        )
    return (
        "complete_profile",
        job_post.title,
        "Complete the missing profile evidence and link your strongest CV, project, and "
        "repository signals.",
    )


def decision_reason(decision: CoachDecision, score: float) -> str:
    if decision == "apply_now":
        return (
            f"Current fit is {score:.1f}. Apply now and make the targeted improvement "
            "in parallel."
        )
    if decision == "apply_after_targeted_fix":
        return f"Current fit is {score:.1f}. Complete the highest-leverage fix, then apply."
    return (
        f"Current fit is {score:.1f}. Build stronger evidence before prioritizing this "
        "application."
    )
