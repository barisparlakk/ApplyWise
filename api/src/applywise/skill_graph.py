from __future__ import annotations

import re
import uuid
from collections import deque
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.models import (
    GitHubRepository,
    JobPost,
    JobSkillMapping,
    Project,
    Resume,
    Skill,
    SkillPrerequisite,
    User,
)

DEFAULT_SKILL_CATEGORIES = {
    "Business Analysis": "business",
    "CI/CD": "delivery",
    "Computer Vision": "ai",
    "Data Analysis": "data",
    "Data Science": "data",
    "Deep Learning": "ai",
    "Docker": "delivery",
    "FastAPI": "backend",
    "Git": "engineering",
    "HTTP": "backend",
    "Image Processing": "ai",
    "Kubernetes": "delivery",
    "Linear Algebra": "foundations",
    "Linux": "engineering",
    "Machine Learning": "ai",
    "Pandas": "data",
    "PostgreSQL": "backend",
    "Python": "programming",
    "SQL": "data",
    "Statistics": "foundations",
    "Testing": "engineering",
}

DEFAULT_PREREQUISITE_EDGES = (
    ("Python", "FastAPI"),
    ("HTTP", "FastAPI"),
    ("SQL", "PostgreSQL"),
    ("Python", "Pandas"),
    ("Pandas", "Data Analysis"),
    ("Statistics", "Data Analysis"),
    ("Data Analysis", "Data Science"),
    ("Python", "Machine Learning"),
    ("Statistics", "Machine Learning"),
    ("Linear Algebra", "Machine Learning"),
    ("Machine Learning", "Deep Learning"),
    ("Deep Learning", "Computer Vision"),
    ("Linear Algebra", "Computer Vision"),
    ("Computer Vision", "Image Processing"),
    ("Git", "CI/CD"),
    ("Testing", "CI/CD"),
    ("Linux", "Docker"),
    ("Docker", "Kubernetes"),
    ("SQL", "Business Analysis"),
    ("Data Analysis", "Business Analysis"),
)


class SkillPathNode(BaseModel):
    name: str
    status: Literal["known", "missing", "target"]


class SkillReadinessPath(BaseModel):
    target_skill: str
    ready: bool
    nodes: list[SkillPathNode]


class SkillGraphResponse(BaseModel):
    job_post_id: uuid.UUID
    target_role: str
    readiness_percent: float
    known_skills: list[str]
    target_skills: list[str]
    recommended_sequence: list[str]
    paths: list[SkillReadinessPath]


def build_job_skill_graph(
    session: Session,
    *,
    user: User,
    job_post: JobPost,
) -> SkillGraphResponse:
    sync_job_skill_mappings(session, job_post)
    known_skills = collect_user_skill_names(session, user)
    known_keys = {skill_key(name) for name in known_skills}
    mappings = session.scalars(
        select(JobSkillMapping)
        .where(JobSkillMapping.job_post_id == job_post.id)
        .order_by(JobSkillMapping.required.desc(), JobSkillMapping.created_at.asc())
    ).all()
    required_mappings = [mapping for mapping in mappings if mapping.required]
    target_mappings = required_mappings or list(mappings)
    target_skills = [mapping.skill.name for mapping in target_mappings]
    reverse_edges = prerequisite_map(session)

    paths = [
        readiness_path(
            target_skill=target_skill,
            known_keys=known_keys,
            reverse_edges=reverse_edges,
        )
        for target_skill in target_skills
    ]
    ready_count = sum(path.ready for path in paths)
    readiness_percent = round((ready_count / len(paths)) * 100, 2) if paths else 100.0
    recommended_sequence: list[str] = []
    seen: set[str] = set()
    for path in paths:
        for node in path.nodes:
            key = skill_key(node.name)
            if node.status != "known" and key not in seen:
                seen.add(key)
                recommended_sequence.append(node.name)

    return SkillGraphResponse(
        job_post_id=job_post.id,
        target_role=job_post.title,
        readiness_percent=readiness_percent,
        known_skills=known_skills,
        target_skills=target_skills,
        recommended_sequence=recommended_sequence,
        paths=paths,
    )


def sync_job_skill_mappings(session: Session, job_post: JobPost) -> None:
    skills_by_key = ensure_default_skill_graph(session)
    required = unique_skill_names(job_post.required_skills or [])
    nice_to_have = unique_skill_names(job_post.nice_to_have_skills or [])
    desired = {skill_key(name): (name, True) for name in required}
    for name in nice_to_have:
        desired.setdefault(skill_key(name), (name, False))

    for key, (name, _required) in desired.items():
        if key not in skills_by_key:
            skill = Skill(name=name, category=infer_category(name))
            session.add(skill)
            session.flush()
            skills_by_key[key] = skill

    existing = list(
        session.scalars(
            select(JobSkillMapping).where(JobSkillMapping.job_post_id == job_post.id)
        ).all()
    )
    existing_by_key = {skill_key(mapping.skill.name): mapping for mapping in existing}
    for key, (_name, required_flag) in desired.items():
        mapping = existing_by_key.get(key)
        if mapping is None:
            session.add(
                JobSkillMapping(
                    job_post_id=job_post.id,
                    skill_id=skills_by_key[key].id,
                    required=required_flag,
                    target_level=3 if required_flag else 2,
                )
            )
        else:
            mapping.required = required_flag
            mapping.target_level = 3 if required_flag else 2
    for key, mapping in existing_by_key.items():
        if key not in desired:
            session.delete(mapping)
    session.flush()


def ensure_default_skill_graph(session: Session) -> dict[str, Skill]:
    skills_by_key = {skill_key(skill.name): skill for skill in session.scalars(select(Skill))}
    for name, category in DEFAULT_SKILL_CATEGORIES.items():
        key = skill_key(name)
        if key not in skills_by_key:
            skill = Skill(name=name, category=category)
            session.add(skill)
            skills_by_key[key] = skill
    session.flush()

    existing_edges = {
        (edge.prerequisite_skill_id, edge.skill_id)
        for edge in session.scalars(select(SkillPrerequisite))
    }
    for prerequisite_name, skill_name in DEFAULT_PREREQUISITE_EDGES:
        prerequisite = skills_by_key[skill_key(prerequisite_name)]
        skill = skills_by_key[skill_key(skill_name)]
        edge_key = (prerequisite.id, skill.id)
        if edge_key not in existing_edges:
            session.add(
                SkillPrerequisite(
                    prerequisite_skill_id=prerequisite.id,
                    skill_id=skill.id,
                )
            )
            existing_edges.add(edge_key)
    session.flush()
    return skills_by_key


def prerequisite_map(session: Session) -> dict[str, list[str]]:
    reverse_edges: dict[str, list[str]] = {}
    edges = session.scalars(select(SkillPrerequisite)).all()
    for edge in edges:
        target = edge.skill.name
        reverse_edges.setdefault(skill_key(target), []).append(edge.prerequisite_skill.name)
    for prerequisites in reverse_edges.values():
        prerequisites.sort(key=str.casefold)
    return reverse_edges


def readiness_path(
    *,
    target_skill: str,
    known_keys: set[str],
    reverse_edges: dict[str, list[str]],
) -> SkillReadinessPath:
    target_key = skill_key(target_skill)
    if target_key in known_keys:
        return SkillReadinessPath(
            target_skill=target_skill,
            ready=True,
            nodes=[SkillPathNode(name=target_skill, status="known")],
        )

    queue: deque[tuple[str, list[str]]] = deque([(target_skill, [target_skill])])
    visited = {target_key}
    root_path: list[str] | None = None
    selected_path: list[str] | None = None
    while queue:
        current, target_to_current = queue.popleft()
        prerequisites = reverse_edges.get(skill_key(current), [])
        if not prerequisites and root_path is None:
            root_path = target_to_current
        for prerequisite in prerequisites:
            key = skill_key(prerequisite)
            if key in visited:
                continue
            visited.add(key)
            candidate = [*target_to_current, prerequisite]
            if key in known_keys:
                selected_path = candidate
                queue.clear()
                break
            queue.append((prerequisite, candidate))

    ordered_names = list(reversed(selected_path or root_path or [target_skill]))
    nodes = [
        SkillPathNode(
            name=name,
            status=(
                "known"
                if skill_key(name) in known_keys
                else "target"
                if index == len(ordered_names) - 1
                else "missing"
            ),
        )
        for index, name in enumerate(ordered_names)
    ]
    return SkillReadinessPath(target_skill=target_skill, ready=False, nodes=nodes)


def collect_user_skill_names(session: Session, user: User) -> list[str]:
    values: list[str] = []
    if user.profile:
        values.extend(user.profile.skills or [])
    resumes = session.scalars(select(Resume).where(Resume.user_id == user.id)).all()
    for resume in resumes:
        values.extend(
            str(skill) for skill in (resume.parsed_data or {}).get("skills", [])
        )
    projects = session.scalars(select(Project).where(Project.user_id == user.id)).all()
    for project in projects:
        values.extend(project.skills or [])
    repositories = session.scalars(
        select(GitHubRepository).where(GitHubRepository.user_id == user.id)
    ).all()
    for repository in repositories:
        values.extend(repository.languages.keys())
        values.extend(
            str(skill) for skill in (repository.analysis_data or {}).get("tech_stack", [])
        )
    return unique_skill_names(values)


def unique_skill_names(values: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for raw_value in values:
        value = " ".join(str(raw_value).split())[:120]
        key = skill_key(value)
        if value and key and key not in seen:
            seen.add(key)
            unique.append(value)
    return unique


def skill_key(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.]+", "", value.casefold())


def infer_category(name: str) -> str:
    lowered = name.casefold()
    if any(token in lowered for token in ("machine", "ai", "vision", "learning")):
        return "ai"
    if any(token in lowered for token in ("sql", "data", "pandas", "statistics")):
        return "data"
    if any(token in lowered for token in ("docker", "ci", "kubernetes", "deploy")):
        return "delivery"
    return "engineering"
