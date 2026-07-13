from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from applywise.database import SessionLocal
from applywise.embeddings import DeterministicEmbeddingProvider, chunk_text
from applywise.fit_score import compute_and_store_fit_analysis
from applywise.interview_prep import generate_or_update_interview_prep
from applywise.job_analyzer import analyze_job_post
from applywise.models import (
    Application,
    ApplicationEvent,
    ApplicationStatus,
    GitHubRepository,
    GitHubRepositoryChunk,
    GoalStatus,
    JobPost,
    Profile,
    Project,
    Resume,
    ResumeChunk,
    Skill,
    User,
    UserGoal,
)
from applywise.roadmap import build_and_store_roadmap

DEMO_EMAIL = "demo@applywise.dev"
DEMO_SUBJECT = f"email:{DEMO_EMAIL}"

embedding_provider = DeterministicEmbeddingProvider()

DEMO_RESUME_TEXT = """
Education
BS Computer Engineering, 3rd year

Experience
Built course and portfolio projects around backend APIs, data analysis, and AI prototypes.
Led a student team project that turned messy internship postings into structured role signals.

Skills
Python, FastAPI, PostgreSQL, SQL, Docker, pandas, scikit-learn, TypeScript, React, Git

Projects
Internship Fit Analyzer
FastAPI and PostgreSQL service that scores internship fit and explains missing skills.

GitHub Repo Quality Scanner
Python tool that checks README quality, test presence, Docker usage, and CI signals.
""".strip()


DEMO_REPOSITORIES = [
    {
        "owner": "applywise-demo",
        "name": "internship-fit-api",
        "description": "FastAPI service for internship fit scoring and roadmap generation.",
        "language": "Python",
        "languages": {"Python": 18500, "Dockerfile": 800},
        "file_tree": [
            "README.md",
            "src/app/main.py",
            "src/app/scoring.py",
            "tests/test_scoring.py",
            "Dockerfile",
            ".github/workflows/ci.yml",
        ],
        "summary": "Backend project using FastAPI, PostgreSQL, Docker, pytest, and CI.",
        "tech_stack": ["Python", "FastAPI", "PostgreSQL", "Docker", "pytest"],
        "roles": ["Backend Intern", "Software Engineering Intern"],
    },
    {
        "owner": "applywise-demo",
        "name": "repo-quality-scanner",
        "description": "Repository analyzer for README, test, Docker, and CI signals.",
        "language": "Python",
        "languages": {"Python": 12200, "Markdown": 1600},
        "file_tree": [
            "README.md",
            "scanner/analyzer.py",
            "tests/test_analyzer.py",
            "docs/checklist.md",
        ],
        "summary": "Static analyzer that summarizes repo quality and portfolio signals.",
        "tech_stack": ["Python", "GitHub REST API", "pytest"],
        "roles": ["Backend Intern", "Process Improvement Intern"],
    },
    {
        "owner": "applywise-demo",
        "name": "student-success-dashboard",
        "description": "Pandas and SQL dashboard for internship preparation metrics.",
        "language": "TypeScript",
        "languages": {"TypeScript": 9800, "Python": 4500, "SQL": 1500},
        "file_tree": [
            "README.md",
            "app/dashboard.tsx",
            "notebooks/analysis.ipynb",
            "queries/application_metrics.sql",
        ],
        "summary": "Analytics dashboard with TypeScript UI, pandas exploration, and SQL metrics.",
        "tech_stack": ["TypeScript", "React", "SQL", "pandas"],
        "roles": ["Business Analyst Intern", "Data Science Intern"],
    },
]

DEMO_JOBS = [
    {
        "company": "Northstar AI",
        "url": "https://example.com/jobs/northstar-ai-ml-intern",
        "status": ApplicationStatus.PREPARING,
        "deadline_offset": 9,
        "next_action": "Review weak-area drills for Docker and CI/CD.",
        "post": """
Company: Northstar AI
Location: Remote
Position: AI/ML Intern

Responsibilities
- Build Python prototypes for RAG and evaluation workflows
- Analyze model quality with pandas and SQL dashboards
- Explain technical tradeoffs in English

Requirements
- Python
- SQL
- Machine Learning
- RAG
- pandas
- English communication

Preferred
- Docker
- CI/CD
""".strip(),
    },
    {
        "company": "Atlas Backend Systems",
        "url": "https://example.com/jobs/atlas-backend-intern",
        "status": ApplicationStatus.APPLIED,
        "deadline_offset": 14,
        "applied_offset": -2,
        "next_action": "Follow up after 7 days if there is no response.",
        "post": """
Company: Atlas Backend Systems
Location: Istanbul / Hybrid
Position: Backend Intern

Responsibilities
- Build FastAPI endpoints for internal workflow tools
- Implement PostgreSQL queries and API integrations
- Add focused tests and deployment documentation

Requirements
- Python
- FastAPI
- PostgreSQL
- REST
- Git
- English communication

Preferred
- Docker
- CI/CD
""".strip(),
    },
    {
        "company": "BrightOps Analytics",
        "url": "https://example.com/jobs/brightops-business-analyst",
        "status": ApplicationStatus.SAVED,
        "deadline_offset": 21,
        "next_action": "Decide whether to apply after improving dashboard examples.",
        "post": """
Company: BrightOps Analytics
Location: Remote
Position: Business Analyst Intern

Responsibilities
- Build SQL dashboards for operational process metrics
- Prepare concise recommendations for business stakeholders
- Clean CSV and spreadsheet datasets with Python

Requirements
- SQL
- Python
- pandas
- dashboard
- communication

Preferred
- Process improvement
- Business intelligence
""".strip(),
    },
]


def main() -> None:
    with SessionLocal() as session:
        recreate_demo_user(session)
        user = create_demo_user(session)
        create_profile(session, user)
        create_resume(session, user)
        create_projects(session, user)
        create_repositories(session, user)
        create_skill_catalog(session)
        create_jobs_and_workflow(session, user)
        create_demo_goal(session, user)
        session.commit()
        print(f"Seeded demo user {DEMO_EMAIL} with {len(DEMO_JOBS)} applications.")
        print("Use the email login provider with this address to explore the full demo.")


def recreate_demo_user(session: Session) -> None:
    seeded_job_posts = session.scalars(select(JobPost).where(JobPost.source == "seed")).all()
    for job_post in seeded_job_posts:
        session.delete(job_post)

    users = session.scalars(
        select(User).where((User.email == DEMO_EMAIL) | (User.auth_subject == DEMO_SUBJECT))
    ).all()
    for user in users:
        session.delete(user)
    session.commit()


def create_demo_user(session: Session) -> User:
    user = User(
        email=DEMO_EMAIL,
        full_name="ApplyWise Demo Student",
        auth_subject=DEMO_SUBJECT,
    )
    session.add(user)
    session.flush()
    return user


def create_profile(session: Session, user: User) -> None:
    session.add(
        Profile(
            user_id=user.id,
            headline="Computer engineering student focused on backend and AI internships",
            bio="Building portfolio projects around internship intelligence workflows.",
            location="Istanbul",
            education_level="BS Computer Engineering, 3rd year",
            skills=[
                "Python",
                "FastAPI",
                "PostgreSQL",
                "SQL",
                "Docker",
                "pandas",
                "TypeScript",
                "React",
                "Git",
            ],
            github_url="https://github.com/applywise-demo",
            preferred_location="Remote or Istanbul",
            internship_type="Summer internship",
            languages=[{"name": "English", "level": "B2"}, {"name": "Turkish", "level": "Native"}],
            experience_level="Project experience",
            target_roles=["Backend Intern", "AI/ML Intern", "Business Analyst Intern"],
        )
    )


def create_resume(session: Session, user: User) -> None:
    parsed_data = {
        "education": ["BS Computer Engineering, 3rd year"],
        "experience": [
            "Built backend APIs, data analysis notebooks, and AI prototype projects.",
            "Led a student project that converts job posts into structured role signals.",
        ],
        "skills": [
            "Python",
            "FastAPI",
            "PostgreSQL",
            "SQL",
            "Docker",
            "pandas",
            "scikit-learn",
            "TypeScript",
            "React",
            "Git",
        ],
        "projects": ["Internship Fit Analyzer", "GitHub Repo Quality Scanner"],
    }
    resume = Resume(
        user_id=user.id,
        filename="applywise_demo_cv.docx",
        content_text=DEMO_RESUME_TEXT,
        parsed_data=parsed_data,
        embedding=embedding_provider.embed(DEMO_RESUME_TEXT),
        embedding_model=embedding_provider.model_name,
    )
    session.add(resume)
    session.flush()
    for index, chunk in enumerate(chunk_text(DEMO_RESUME_TEXT)):
        session.add(
            ResumeChunk(
                resume_id=resume.id,
                chunk_index=index,
                content=chunk,
                embedding=embedding_provider.embed(chunk),
                embedding_model=embedding_provider.model_name,
            )
        )


def create_projects(session: Session, user: User) -> None:
    projects = [
        Project(
            user_id=user.id,
            name="Internship Fit Analyzer",
            description=(
                "FastAPI and PostgreSQL service that scores internship fit "
                "and generates prep plans."
            ),
            url="https://github.com/applywise-demo/internship-fit-api",
            skills=["Python", "FastAPI", "PostgreSQL", "Docker", "pytest"],
        ),
        Project(
            user_id=user.id,
            name="Student Success Dashboard",
            description="SQL and pandas dashboard for tracking internship preparation metrics.",
            url="https://github.com/applywise-demo/student-success-dashboard",
            skills=["SQL", "pandas", "TypeScript", "React"],
        ),
    ]
    session.add_all(projects)


def create_repositories(session: Session, user: User) -> None:
    for repo_data in DEMO_REPOSITORIES:
        full_name = f"{repo_data['owner']}/{repo_data['name']}"
        summary = str(repo_data["summary"])
        repository = GitHubRepository(
            user_id=user.id,
            owner=str(repo_data["owner"]),
            name=str(repo_data["name"]),
            full_name=full_name,
            html_url=f"https://github.com/{full_name}",
            description=str(repo_data["description"]),
            language=str(repo_data["language"]),
            stars=12,
            default_branch="main",
            last_commit_at=datetime.now(UTC) - timedelta(days=6),
            readme_text=f"# {repo_data['name']}\n\n{summary}\n\n## Testing\nRun pytest.",
            languages=dict(repo_data["languages"]),
            file_tree=list(repo_data["file_tree"]),
            deterministic_signals={
                "readme_length": len(summary),
                "has_tests": any("test" in path for path in repo_data["file_tree"]),
                "has_docker": any(path == "Dockerfile" for path in repo_data["file_tree"]),
                "has_ci": any(".github/workflows" in path for path in repo_data["file_tree"]),
                "has_docs": True,
                "has_deployment_config": any(
                    path == "Dockerfile" for path in repo_data["file_tree"]
                ),
                "file_count": len(repo_data["file_tree"]),
                "directory_count": len(
                    {str(path).split("/")[0] for path in repo_data["file_tree"]}
                ),
                "language_count": len(repo_data["languages"]),
                "top_level_directories": sorted(
                    {
                        str(path).split("/")[0]
                        for path in repo_data["file_tree"]
                        if "/" in str(path)
                    }
                ),
            },
            analysis_data={
                "readme_quality": "Good",
                "tech_stack": list(repo_data["tech_stack"]),
                "complexity": "Medium",
                "commit_activity": "Recent",
                "testing": "Tests detected",
                "deployment": (
                    "Docker signal" if "Docker" in repo_data["tech_stack"] else "Not explicit"
                ),
                "architecture_signals": ["Modular structure", "Clear README"],
                "missing_documentation": ["Deployment walkthrough"],
                "best_fit_roles": list(repo_data["roles"]),
                "strengths": [
                    "Clear internship-relevant scope",
                    "Evidence of implementation depth",
                ],
                "weaknesses": ["Could add more screenshots or usage examples"],
                "recommendations": [
                    "Add one short demo GIF or screenshot",
                    "Document setup commands",
                ],
            },
            summary_text=summary,
        )
        session.add(repository)
        session.flush()
        for index, chunk in enumerate(chunk_text(summary)):
            session.add(
                GitHubRepositoryChunk(
                    repository_id=repository.id,
                    chunk_index=index,
                    content=chunk,
                    embedding=embedding_provider.embed(chunk),
                    embedding_model=embedding_provider.model_name,
                )
            )


def create_skill_catalog(session: Session) -> None:
    for skill in [
        "Python",
        "FastAPI",
        "PostgreSQL",
        "SQL",
        "Docker",
        "pandas",
        "Machine Learning",
        "RAG",
        "CI/CD",
        "TypeScript",
        "React",
    ]:
        existing = session.scalars(select(Skill).where(Skill.name == skill)).first()
        if existing is None:
            session.add(Skill(name=skill, category="demo"))


def create_jobs_and_workflow(session: Session, user: User) -> None:
    today = date.today()
    for job_data in DEMO_JOBS:
        analysis = analyze_job_post(str(job_data["post"]))
        job_post = JobPost(
            user_id=user.id,
            company_name=str(job_data["company"]),
            title=analysis.role_title,
            description=str(job_data["post"]),
            location="Remote",
            url=str(job_data["url"]),
            source="demo",
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
            embedding=embedding_provider.embed(str(job_data["post"])),
            embedding_model=embedding_provider.model_name,
        )
        session.add(job_post)
        session.flush()

        application = Application(
            user_id=user.id,
            job_post_id=job_post.id,
            status=job_data["status"],
            deadline=today + timedelta(days=int(job_data["deadline_offset"])),
            applied_date=(
                today + timedelta(days=int(job_data["applied_offset"]))
                if "applied_offset" in job_data
                else None
            ),
            notes=f"Demo tracker entry for {job_data['company']}.",
            next_action=str(job_data["next_action"]),
        )
        session.add(application)
        session.flush()
        session.add(
            ApplicationEvent(
                user_id=user.id,
                application_id=application.id,
                event_type="created",
                from_status=None,
                to_status=application.status,
                event_data={"source": "demo_seed"},
            )
        )

        fit_analysis = compute_and_store_fit_analysis(session, user=user, job_post=job_post)
        build_and_store_roadmap(
            session,
            user=user,
            fit_analysis=fit_analysis,
            job_post=job_post,
            duration_days=7,
        )
        generate_or_update_interview_prep(session, user=user, application=application)


def create_demo_goal(session: Session, user: User) -> None:
    session.add(
        UserGoal(
            user_id=user.id,
            title="Build a focused internship pipeline",
            target_role="Backend Intern",
            target_date=date.today() + timedelta(days=30),
            weekly_application_target=5,
            status=GoalStatus.ACTIVE,
            progress_data={"source": "demo_seed"},
        )
    )


if __name__ == "__main__":
    main()
