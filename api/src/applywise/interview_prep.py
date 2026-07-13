from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.cloudflare_ai import CloudflareAIError, CloudflareWorkersAIClient
from applywise.embeddings import get_embedding_provider, safe_embed
from applywise.environment import boolean_environment
from applywise.fit_score import compute_and_store_fit_analysis, latest_fit_analysis
from applywise.models import (
    Application,
    FitAnalysis,
    GitHubRepository,
    GitHubRepositoryChunk,
    InterviewPrep,
    JobPost,
    Profile,
    Project,
    Resume,
    ResumeChunk,
    User,
)

InterviewPrepSection = Literal[
    "technical_questions",
    "behavioral_questions",
    "english_self_introduction",
    "project_explanation_script",
    "why_this_company",
    "why_this_role",
    "star_answer_templates",
    "weak_area_drill_questions",
]

SECTION_KEYS: tuple[InterviewPrepSection, ...] = (
    "technical_questions",
    "behavioral_questions",
    "english_self_introduction",
    "project_explanation_script",
    "why_this_company",
    "why_this_role",
    "star_answer_templates",
    "weak_area_drill_questions",
)

embedding_provider = get_embedding_provider()


class PrepQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    guidance: str = Field(min_length=1, max_length=1200)
    grounded_evidence: list[str] = Field(default_factory=list)
    related_skills: list[str] = Field(default_factory=list)

    @field_validator("grounded_evidence", "related_skills")
    @classmethod
    def normalize_list(cls, values: list[str]) -> list[str]:
        return unique_text(values)[:6]


class PrepScript(BaseModel):
    content: str = Field(min_length=1, max_length=2500)
    grounded_evidence: list[str] = Field(default_factory=list)

    @field_validator("grounded_evidence")
    @classmethod
    def normalize_evidence(cls, values: list[str]) -> list[str]:
        return unique_text(values)[:6]


class StarTemplate(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    situation: str = Field(min_length=1, max_length=800)
    task: str = Field(min_length=1, max_length=800)
    action: str = Field(min_length=1, max_length=1000)
    result: str = Field(min_length=1, max_length=800)
    grounded_evidence: list[str] = Field(default_factory=list)

    @field_validator("grounded_evidence")
    @classmethod
    def normalize_evidence(cls, values: list[str]) -> list[str]:
        return unique_text(values)[:6]


class InterviewPrepContent(BaseModel):
    technical_questions: list[PrepQuestion] = Field(default_factory=list)
    behavioral_questions: list[PrepQuestion] = Field(default_factory=list)
    english_self_introduction: PrepScript
    project_explanation_script: PrepScript
    why_this_company: PrepScript
    why_this_role: PrepScript
    star_answer_templates: list[StarTemplate] = Field(default_factory=list)
    weak_area_drill_questions: list[PrepQuestion] = Field(default_factory=list)


class InterviewPrepPlan(BaseModel):
    focus_areas: list[str]
    content: InterviewPrepContent


class InterviewPrepProvider(Protocol):
    def generate_interview_prep_json(self, payload: dict[str, Any]) -> str: ...


class InterviewPrepGenerationError(RuntimeError):
    pass


class CloudflareInterviewPrepProvider:
    def __init__(self, client: CloudflareWorkersAIClient) -> None:
        self.client = client

    def generate_interview_prep_json(self, payload: dict[str, Any]) -> str:
        try:
            return self.client.generate_json(
                system_prompt=(
                    "Create a complete, role-specific interview preparation pack using the "
                    "requested JSON schema. Ground every candidate claim in the supplied evidence. "
                    "Each grounded_evidence value must exactly match one supplied evidence label. "
                    "Reference actual job requirements, fit gaps, and project facts; do not invent "
                    "experience, metrics, company facts, or technologies. Make questions specific "
                    "and scripts natural to speak aloud. Use English for the English introduction "
                    "and the main language of the job post for other sections."
                ),
                user_content=json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
                json_schema=InterviewPrepPlan.model_json_schema(),
                max_tokens=6000,
                temperature=0.25,
            )
        except CloudflareAIError as exc:
            raise InterviewPrepGenerationError(
                "Cloudflare interview preparation failed."
            ) from exc


@dataclass(frozen=True)
class EvidenceSnippet:
    source: str
    text: str
    embedding: list[float] | None = None
    embedding_model: str | None = None

    @property
    def label(self) -> str:
        return f"{self.source}: {shorten(self.text, 180)}"


@dataclass(frozen=True)
class InterviewContext:
    profile: Profile | None
    resumes: list[Resume]
    resume_chunks: list[ResumeChunk]
    projects: list[Project]
    repositories: list[GitHubRepository]
    repository_chunks: list[GitHubRepositoryChunk]
    fit_analysis: FitAnalysis
    evidence: list[EvidenceSnippet]


def generate_or_update_interview_prep(
    session: Session,
    *,
    user: User,
    application: Application,
    sections: list[InterviewPrepSection] | None = None,
) -> InterviewPrep:
    job_post = application.job_post
    if job_post is None:
        raise ValueError("Application is not linked to a job post.")

    existing = latest_interview_prep(session, user=user, application=application)
    selected_sections = normalize_sections(sections)
    if existing is not None and selected_sections is None:
        return existing

    context = load_interview_context(session, user=user, job_post=job_post)
    generated = build_interview_prep_plan(
        user=user,
        job_post=job_post,
        context=context,
        sections=selected_sections,
    )

    if existing is None:
        content = generated.content
    else:
        current_content = items_to_content(existing.questions)
        content = merge_content(current_content, generated.content, selected_sections)

    values = {
        "user_id": user.id,
        "job_post_id": job_post.id,
        "application_id": application.id,
        "focus_areas": generated.focus_areas,
        "questions": content_to_items(content),
    }

    if existing is None:
        prep = InterviewPrep(**values)
        session.add(prep)
    else:
        prep = existing
        for key, value in values.items():
            setattr(prep, key, value)

    session.flush()
    return prep


def latest_interview_prep(
    session: Session,
    *,
    user: User,
    application: Application,
) -> InterviewPrep | None:
    return session.scalars(
        select(InterviewPrep)
        .where(
            InterviewPrep.user_id == user.id,
            InterviewPrep.application_id == application.id,
        )
        .order_by(InterviewPrep.updated_at.desc(), InterviewPrep.created_at.desc())
        .limit(1)
    ).first()


def interview_prep_to_content(prep: InterviewPrep) -> InterviewPrepContent:
    return items_to_content(prep.questions or [])


def load_interview_context(session: Session, *, user: User, job_post: JobPost) -> InterviewContext:
    fit_analysis = latest_fit_analysis(session, user=user, job_post=job_post)
    if fit_analysis is None:
        fit_analysis = compute_and_store_fit_analysis(session, user=user, job_post=job_post)

    resumes = list(
        session.scalars(
            select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc())
        ).all()
    )
    resume_chunks = list(
        session.scalars(
            select(ResumeChunk)
            .join(Resume)
            .where(Resume.user_id == user.id)
            .order_by(ResumeChunk.created_at.desc())
        ).all()
    )
    projects = list(
        session.scalars(
            select(Project).where(Project.user_id == user.id).order_by(Project.created_at.desc())
        ).all()
    )
    repositories = list(
        session.scalars(
            select(GitHubRepository)
            .where(GitHubRepository.user_id == user.id)
            .order_by(GitHubRepository.updated_at.desc())
        ).all()
    )
    repository_chunks = list(
        session.scalars(
            select(GitHubRepositoryChunk)
            .join(GitHubRepository)
            .where(GitHubRepository.user_id == user.id)
            .order_by(GitHubRepositoryChunk.created_at.desc())
        ).all()
    )
    evidence = collect_evidence(
        profile=user.profile,
        resumes=resumes,
        resume_chunks=resume_chunks,
        projects=projects,
        repositories=repositories,
        repository_chunks=repository_chunks,
        job_post=job_post,
        fit_analysis=fit_analysis,
    )
    return InterviewContext(
        profile=user.profile,
        resumes=resumes,
        resume_chunks=resume_chunks,
        projects=projects,
        repositories=repositories,
        repository_chunks=repository_chunks,
        fit_analysis=fit_analysis,
        evidence=evidence,
    )


def build_interview_prep_plan(
    *,
    user: User,
    job_post: JobPost,
    context: InterviewContext,
    sections: list[InterviewPrepSection] | None = None,
    provider: InterviewPrepProvider | None = None,
) -> InterviewPrepPlan:
    local_plan = build_local_interview_prep_plan(user=user, job_post=job_post, context=context)
    explicit_provider = provider is not None
    try:
        selected_provider = provider or get_interview_prep_provider()
    except InterviewPrepGenerationError:
        if explicit_provider or not boolean_environment("AI_ALLOW_LOCAL_FALLBACK", True):
            raise
        return local_plan

    if selected_provider is None:
        return local_plan

    evidence = top_evidence(
        context.evidence,
        job_post,
        missing_skills_from_context(context),
        limit=8,
    )
    payload = build_interview_generation_payload(
        user=user,
        job_post=job_post,
        context=context,
        evidence=evidence,
        sections=sections,
    )
    last_error: Exception | None = None
    for _attempt in range(2):
        try:
            generated = InterviewPrepPlan.model_validate_json(
                selected_provider.generate_interview_prep_json(payload)
            )
            validate_generated_interview_prep(generated)
            return sanitize_generated_grounding(generated, evidence, local_plan)
        except (InterviewPrepGenerationError, ValidationError, ValueError) as exc:
            last_error = exc
            if isinstance(exc, InterviewPrepGenerationError):
                break

    if explicit_provider or not boolean_environment("AI_ALLOW_LOCAL_FALLBACK", True):
        raise InterviewPrepGenerationError(
            "Interview preparation provider returned invalid output."
        ) from last_error
    return local_plan


def build_local_interview_prep_plan(
    *,
    user: User,
    job_post: JobPost,
    context: InterviewContext,
) -> InterviewPrepPlan:
    signals = (context.fit_analysis.breakdown or {}).get("signals", {})
    missing_skills = [str(item) for item in signals.get("missing_required_skills", [])]
    matched_skills = [str(item) for item in signals.get("matched_skills", [])]
    focus_areas = unique_text([*missing_skills, job_post.domain or "", job_post.title])[:8]
    evidence = top_evidence(context.evidence, job_post, missing_skills)
    evidence_labels = [item.label for item in evidence]
    strongest_project = select_project_anchor(context, evidence)
    primary_skills = unique_text(
        [
            *(job_post.required_skills or []),
            *(job_post.nice_to_have_skills or []),
        ]
    )
    question_skills = unique_text([*primary_skills, job_post.domain or "systems design"])[:5]
    weak_skills = missing_skills[:4] or [
        skill for skill in question_skills if skill not in matched_skills
    ][:3]

    content = InterviewPrepContent(
        technical_questions=[
            technical_question_for(skill, job_post, evidence_labels)
            for skill in question_skills[:5]
        ],
        behavioral_questions=behavioral_questions(job_post, evidence_labels),
        english_self_introduction=self_introduction_script(
            user,
            job_post,
            context,
            evidence_labels,
        ),
        project_explanation_script=project_script(job_post, strongest_project, evidence_labels),
        why_this_company=why_company_script(job_post, context, evidence_labels),
        why_this_role=why_role_script(
            job_post,
            context,
            matched_skills,
            missing_skills,
            evidence_labels,
        ),
        star_answer_templates=star_templates(job_post, strongest_project, evidence_labels),
        weak_area_drill_questions=[
            weak_area_question_for(skill, job_post, evidence_labels) for skill in weak_skills[:4]
        ],
    )
    return InterviewPrepPlan(focus_areas=focus_areas, content=content)


def get_interview_prep_provider() -> InterviewPrepProvider | None:
    provider = os.environ.get("LLM_PROVIDER", "local").strip().lower()
    if provider in {"", "local", "heuristic"}:
        return None
    if provider == "cloudflare":
        try:
            return CloudflareInterviewPrepProvider(
                CloudflareWorkersAIClient.from_environment()
            )
        except CloudflareAIError as exc:
            raise InterviewPrepGenerationError(
                "Cloudflare AI is not fully configured."
            ) from exc
    raise InterviewPrepGenerationError(f"Unsupported interview prep provider: {provider}.")


def missing_skills_from_context(context: InterviewContext) -> list[str]:
    signals = (context.fit_analysis.breakdown or {}).get("signals", {})
    if not isinstance(signals, dict):
        return []
    return [
        str(value)
        for value in signals.get("missing_required_skills", [])
        if isinstance(value, str)
    ]


def build_interview_generation_payload(
    *,
    user: User,
    job_post: JobPost,
    context: InterviewContext,
    evidence: list[EvidenceSnippet],
    sections: list[InterviewPrepSection] | None,
) -> dict[str, Any]:
    breakdown = context.fit_analysis.breakdown or {}
    return {
        "candidate_name": user.full_name or "Candidate",
        "job": {
            "company": job_post.company_name,
            "role": job_post.title,
            "domain": job_post.domain,
            "required_skills": job_post.required_skills,
            "nice_to_have_skills": job_post.nice_to_have_skills,
            "responsibilities": job_post.responsibilities,
            "hidden_expectations": job_post.hidden_expectations,
            "business_expectations": job_post.business_expectations,
            "communication_expectations": job_post.communication_expectations,
            "description_excerpt": job_post.description[:5000],
        },
        "fit": {
            "total": context.fit_analysis.total_score,
            "components": breakdown.get("components", {}),
            "signals": breakdown.get("signals", {}),
        },
        "evidence": [
            {"label": snippet.label, "text": snippet.text[:1200]} for snippet in evidence
        ],
        "requested_sections": list(sections or SECTION_KEYS),
        "variant_instruction": (
            "Generate a fresh angle for the requested sections while keeping all claims grounded."
            if sections
            else "Generate the first complete preparation pack."
        ),
    }


def validate_generated_interview_prep(plan: InterviewPrepPlan) -> None:
    content = plan.content
    if not plan.focus_areas:
        raise ValueError("Interview prep needs focus areas.")
    if not content.technical_questions or not content.behavioral_questions:
        raise ValueError("Interview prep needs technical and behavioral questions.")
    if not content.star_answer_templates or not content.weak_area_drill_questions:
        raise ValueError("Interview prep needs STAR templates and weak-area drills.")


def sanitize_generated_grounding(
    generated: InterviewPrepPlan,
    evidence: list[EvidenceSnippet],
    fallback: InterviewPrepPlan,
) -> InterviewPrepPlan:
    allowed = {snippet.label.casefold(): snippet.label for snippet in evidence}
    fallback_labels = [snippet.label for snippet in evidence[:2]]

    def clean(values: list[str]) -> list[str]:
        cleaned = unique_text(
            [allowed[value.casefold()] for value in values if value.casefold() in allowed]
        )
        return cleaned or fallback_labels[:1]

    def clean_question(question: PrepQuestion) -> PrepQuestion:
        return question.model_copy(
            update={"grounded_evidence": clean(question.grounded_evidence)}
        )

    def clean_script(script: PrepScript) -> PrepScript:
        return script.model_copy(update={"grounded_evidence": clean(script.grounded_evidence)})

    def clean_star(template: StarTemplate) -> StarTemplate:
        return template.model_copy(
            update={"grounded_evidence": clean(template.grounded_evidence)}
        )

    content = generated.content.model_copy(
        update={
            "technical_questions": [
                clean_question(question) for question in generated.content.technical_questions
            ],
            "behavioral_questions": [
                clean_question(question) for question in generated.content.behavioral_questions
            ],
            "english_self_introduction": clean_script(
                generated.content.english_self_introduction
            ),
            "project_explanation_script": clean_script(
                generated.content.project_explanation_script
            ),
            "why_this_company": clean_script(generated.content.why_this_company),
            "why_this_role": clean_script(generated.content.why_this_role),
            "star_answer_templates": [
                clean_star(template) for template in generated.content.star_answer_templates
            ],
            "weak_area_drill_questions": [
                clean_question(question)
                for question in generated.content.weak_area_drill_questions
            ],
        }
    )
    return InterviewPrepPlan(
        focus_areas=unique_text(generated.focus_areas)[:8] or fallback.focus_areas,
        content=content,
    )


def collect_evidence(
    *,
    profile: Profile | None,
    resumes: list[Resume],
    resume_chunks: list[ResumeChunk],
    projects: list[Project],
    repositories: list[GitHubRepository],
    repository_chunks: list[GitHubRepositoryChunk],
    job_post: JobPost,
    fit_analysis: FitAnalysis,
) -> list[EvidenceSnippet]:
    evidence: list[EvidenceSnippet] = []
    if profile is not None:
        profile_text = " ".join(
            unique_text(
                [
                    profile.education_level or "",
                    profile.experience_level or "",
                    ", ".join(profile.skills or []),
                    ", ".join(profile.target_roles or []),
                    ", ".join(
                        f"{item.get('name', '')} {item.get('level', '')}"
                        for item in (profile.languages or [])
                    ),
                ]
            )
        )
        if profile_text:
            profile_embedding = safe_embed(embedding_provider, profile_text)
            evidence.append(
                EvidenceSnippet(
                    source="Profile",
                    text=profile_text,
                    embedding=profile_embedding,
                    embedding_model=(
                        embedding_provider.model_name if profile_embedding is not None else None
                    ),
                )
            )

    for project in projects:
        text = " ".join(
            unique_text([project.name, project.description or "", ", ".join(project.skills or [])])
        )
        if text:
            evidence.append(EvidenceSnippet(source=f"Project {project.name}", text=text))

    for resume in resumes[:2]:
        parsed = resume.parsed_data or {}
        parsed_text = " ".join(
            unique_text(
                [
                    resume.filename,
                    ", ".join(str(item) for item in parsed.get("education", [])),
                    ", ".join(str(item) for item in parsed.get("experience", [])),
                    ", ".join(str(item) for item in parsed.get("skills", [])),
                    ", ".join(str(item) for item in parsed.get("projects", [])),
                ]
            )
        )
        if parsed_text:
            evidence.append(
                EvidenceSnippet(
                    source=f"Resume {resume.filename}",
                    text=parsed_text,
                    embedding=resume.embedding,
                    embedding_model=resume.embedding_model,
                )
            )

    for chunk in resume_chunks[:10]:
        if chunk.content:
            evidence.append(
                EvidenceSnippet(
                    source="Resume chunk",
                    text=chunk.content,
                    embedding=chunk.embedding,
                    embedding_model=chunk.embedding_model,
                )
            )

    for repository in repositories:
        analysis_data = repository.analysis_data or {}
        text = " ".join(
            unique_text(
                [
                    repository.full_name,
                    repository.description or "",
                    repository.summary_text or "",
                    ", ".join(repository.languages.keys()),
                    ", ".join(str(item) for item in analysis_data.get("strengths", [])),
                    ", ".join(str(item) for item in analysis_data.get("best_fit_roles", [])),
                ]
            )
        )
        if text:
            evidence.append(EvidenceSnippet(source=f"Repository {repository.full_name}", text=text))

    for chunk in repository_chunks[:10]:
        if chunk.content:
            evidence.append(
                EvidenceSnippet(
                    source="Repository chunk",
                    text=chunk.content,
                    embedding=chunk.embedding,
                    embedding_model=chunk.embedding_model,
                )
            )

    score_summary = (
        f"Fit score {context_score(fit_analysis)} for {job_post.title}; "
        f"required skills: {', '.join(job_post.required_skills or [])}."
    )
    score_embedding = safe_embed(embedding_provider, score_summary)
    evidence.append(
        EvidenceSnippet(
            source="Fit analysis",
            text=score_summary,
            embedding=score_embedding,
            embedding_model=(
                embedding_provider.model_name if score_embedding is not None else None
            ),
        )
    )
    return evidence


def top_evidence(
    evidence: list[EvidenceSnippet],
    job_post: JobPost,
    missing_skills: list[str],
    *,
    limit: int = 6,
) -> list[EvidenceSnippet]:
    query = " ".join(
        [
            job_post.title,
            job_post.company_name,
            job_post.domain or "",
            " ".join(job_post.required_skills or []),
            " ".join(missing_skills),
            job_post.description[:1200],
        ]
    )
    query_embedding = safe_embed(embedding_provider, query)
    scored = [
        (
            cosine_similarity(
                query_embedding,
                evidence_embedding(snippet),
            ),
            snippet,
        )
        for snippet in evidence
    ]
    scored.sort(key=lambda item: item[0], reverse=True)
    return [snippet for _, snippet in scored[:limit]]


def evidence_embedding(snippet: EvidenceSnippet) -> list[float] | None:
    if (
        snippet.embedding is not None
        and snippet.embedding_model == embedding_provider.model_name
    ):
        return snippet.embedding
    return safe_embed(embedding_provider, snippet.text)


def select_project_anchor(
    context: InterviewContext,
    evidence: list[EvidenceSnippet],
) -> str:
    if context.projects:
        project = context.projects[0]
        skills = ", ".join(project.skills or [])
        return f"{project.name}: {shorten(project.description or skills or project.name, 220)}"
    if context.repositories:
        repository = context.repositories[0]
        repository_text = repository.summary_text or repository.description or repository.full_name
        return (
            f"{repository.full_name}: "
            f"{shorten(repository_text, 220)}"
        )
    project_evidence = next(
        (snippet.label for snippet in evidence if "project" in snippet.source.lower()),
        None,
    )
    return project_evidence or "a relevant academic or portfolio project from the profile"


def technical_question_for(
    skill: str,
    job_post: JobPost,
    evidence: list[str],
) -> PrepQuestion:
    return PrepQuestion(
        question=(
            f"How would you use {skill} in a {job_post.title} workflow at "
            f"{job_post.company_name}?"
        ),
        guidance=(
            "Answer with one concrete example from your profile, then explain the tradeoffs, "
            "failure modes, and how you would validate the result in production or during an "
            "internship task."
        ),
        grounded_evidence=evidence[:3],
        related_skills=[skill, job_post.domain or job_post.title],
    )


def weak_area_question_for(
    skill: str,
    job_post: JobPost,
    evidence: list[str],
) -> PrepQuestion:
    return PrepQuestion(
        question=f"Drill: explain the core {skill} concepts this {job_post.title} role expects.",
        guidance=(
            f"Prepare a 90-second answer covering what {skill} is used for, one common mistake, "
            "and the smallest project task you could complete to prove readiness."
        ),
        grounded_evidence=evidence[:3],
        related_skills=[skill],
    )


def behavioral_questions(job_post: JobPost, evidence: list[str]) -> list[PrepQuestion]:
    expectations = unique_text(
        [
            *(job_post.communication_expectations or []),
            *(job_post.business_expectations or []),
            *(job_post.responsibilities or []),
        ]
    )
    prompts = expectations[:3] or [
        "working with ambiguous requirements",
        "learning a new tool quickly",
        "communicating technical tradeoffs",
    ]
    return [
        PrepQuestion(
            question=f"Tell me about a time you handled {prompt}.",
            guidance=(
                "Use STAR. Keep the situation short, name your exact responsibility, describe "
                "the technical action, and close with a measurable or observable result."
            ),
            grounded_evidence=evidence[:3],
            related_skills=[job_post.domain or job_post.title],
        )
        for prompt in prompts
    ]


def self_introduction_script(
    user: User,
    job_post: JobPost,
    context: InterviewContext,
    evidence: list[str],
) -> PrepScript:
    profile = context.profile
    name = user.full_name or "I"
    education = profile.education_level if profile else None
    skills = ", ".join((profile.skills if profile else [])[:5])
    target = ", ".join((profile.target_roles if profile else [])[:2])
    project = select_project_anchor(context, top_evidence(context.evidence, job_post, []))
    content = (
        f"Hi, I am {name}. I am {education or 'a computer engineering/data-AI student'} "
        f"focused on {target or job_post.title}. My strongest relevant skills for this role are "
        f"{skills or ', '.join((job_post.required_skills or [])[:3])}. "
        "A project I would highlight "
        f"is {project}. I am interested in this {job_post.title} opportunity because it connects "
        f"my current hands-on work with {job_post.domain or 'the role domain'} and gives me "
        "a clear "
        "path to contribute while learning from production-level feedback."
    )
    return PrepScript(content=content, grounded_evidence=evidence[:4])


def project_script(job_post: JobPost, project_anchor: str, evidence: list[str]) -> PrepScript:
    content = (
        f"For the project explanation, lead with: '{project_anchor}'. Then explain the problem, "
        "your ownership, the stack, and one technical decision that matters for a "
        f"{job_post.title}. "
        "Close by naming what you would improve next, especially testing, deployment, "
        "data quality, "
        "or reliability if those are relevant to the role."
    )
    return PrepScript(content=content, grounded_evidence=evidence[:4])


def why_company_script(
    job_post: JobPost,
    context: InterviewContext,
    evidence: list[str],
) -> PrepScript:
    role_skills = ", ".join((job_post.required_skills or [])[:4]) or "skills I am building"
    matched = (context.fit_analysis.breakdown or {}).get("signals", {}).get("matched_skills", [])
    matched_text = ", ".join(str(item) for item in matched[:4])
    content = (
        f"I am interested in {job_post.company_name} because the {job_post.title} role is tied to "
        f"{job_post.domain or 'a domain I want to grow in'} and asks for {role_skills}. "
        f"My profile already shows evidence around {matched_text or 'the role basics'}, "
        "so I can contribute to scoped internship tasks while using the team's feedback "
        "to close the "
        "remaining gaps."
    )
    return PrepScript(content=content, grounded_evidence=evidence[:4])


def why_role_script(
    job_post: JobPost,
    context: InterviewContext,
    matched_skills: list[str],
    missing_skills: list[str],
    evidence: list[str],
) -> PrepScript:
    score = context.fit_analysis.total_score
    role_focus = ", ".join((job_post.required_skills or [])[:4]) or (
        job_post.domain or "technical problem solving"
    )
    content = (
        f"This {job_post.title} role fits my direction because it combines "
        f"{role_focus} with internship-level learning. My current fit score is {score:.1f}, "
        "with matches "
        f"in {', '.join(matched_skills[:4]) or 'my saved profile evidence'}. "
        "The gaps I would prepare "
        f"for first are {', '.join(missing_skills[:3]) or 'deeper role-specific examples'}, "
        "and I can "
        "use the internship to turn those into practical project experience."
    )
    return PrepScript(content=content, grounded_evidence=evidence[:4])


def star_templates(
    job_post: JobPost,
    project_anchor: str,
    evidence: list[str],
) -> list[StarTemplate]:
    return [
        StarTemplate(
            prompt="Describe a technical project you are proud of.",
            situation=f"Use {project_anchor} as the situation and explain the original problem.",
            task=f"State your ownership and why it mattered for a {job_post.title} skill area.",
            action=(
                "Name the implementation choices, the tools used, and how you checked correctness."
            ),
            result="Close with what worked, what changed, and the next improvement you would make.",
            grounded_evidence=evidence[:4],
        ),
        StarTemplate(
            prompt="Tell me about learning a skill quickly.",
            situation="Pick a course, project, repo, or CV item where a gap was visible.",
            task="Explain what you needed to learn and the deadline or constraint.",
            action="Describe the resources, practice task, and feedback loop you used.",
            result="Tie the result back to readiness for this internship role.",
            grounded_evidence=evidence[:4],
        ),
    ]


def content_to_items(content: InterviewPrepContent) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    items.extend(
        {"kind": "technical_question", **question.model_dump()}
        for question in content.technical_questions
    )
    items.extend(
        {"kind": "behavioral_question", **question.model_dump()}
        for question in content.behavioral_questions
    )
    for section in (
        "english_self_introduction",
        "project_explanation_script",
        "why_this_company",
        "why_this_role",
    ):
        script = getattr(content, section)
        items.append({"kind": "script", "section": section, **script.model_dump()})
    items.extend(
        {"kind": "star_template", **template.model_dump()}
        for template in content.star_answer_templates
    )
    items.extend(
        {"kind": "weak_area_drill", **question.model_dump()}
        for question in content.weak_area_drill_questions
    )
    return items


def items_to_content(items: list[dict[str, Any]]) -> InterviewPrepContent:
    technical = []
    behavioral = []
    weak_drills = []
    star_items = []
    scripts: dict[str, PrepScript] = {}

    for item in items:
        try:
            kind = item.get("kind")
            if kind == "technical_question":
                technical.append(PrepQuestion.model_validate(item))
            elif kind == "behavioral_question":
                behavioral.append(PrepQuestion.model_validate(item))
            elif kind == "weak_area_drill":
                weak_drills.append(PrepQuestion.model_validate(item))
            elif kind == "star_template":
                star_items.append(StarTemplate.model_validate(item))
            elif kind == "script":
                section = str(item.get("section"))
                scripts[section] = PrepScript.model_validate(item)
        except ValueError:
            continue

    fallback_script = PrepScript(
        content="Generate this section again to refresh the prep content.",
        grounded_evidence=[],
    )
    return InterviewPrepContent(
        technical_questions=technical,
        behavioral_questions=behavioral,
        english_self_introduction=scripts.get("english_self_introduction", fallback_script),
        project_explanation_script=scripts.get("project_explanation_script", fallback_script),
        why_this_company=scripts.get("why_this_company", fallback_script),
        why_this_role=scripts.get("why_this_role", fallback_script),
        star_answer_templates=star_items,
        weak_area_drill_questions=weak_drills,
    )


def merge_content(
    current: InterviewPrepContent,
    generated: InterviewPrepContent,
    sections: set[InterviewPrepSection],
) -> InterviewPrepContent:
    data = current.model_dump()
    generated_data = generated.model_dump()
    for section in sections:
        data[section] = generated_data[section]
    return InterviewPrepContent.model_validate(data)


def normalize_sections(
    sections: list[InterviewPrepSection] | None,
) -> set[InterviewPrepSection] | None:
    if not sections:
        return None
    return {section for section in sections if section in SECTION_KEYS}


def context_score(fit_analysis: FitAnalysis) -> str:
    return f"{fit_analysis.total_score:.1f}"


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot_product = sum(a * b for a, b in zip(left, right, strict=True))
    left_magnitude = sum(a * a for a in left) ** 0.5
    right_magnitude = sum(b * b for b in right) ** 0.5
    if left_magnitude == 0 or right_magnitude == 0:
        return 0.0
    return dot_product / (left_magnitude * right_magnitude)


def unique_text(values: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw_value in values:
        value = raw_value.strip()
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            normalized.append(value)
    return normalized


def shorten(value: str, limit: int) -> str:
    compact = " ".join(value.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."
