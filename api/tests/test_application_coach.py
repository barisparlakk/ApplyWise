from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from applywise.application_coach import build_application_coach
from applywise.models import Base, FitAnalysis, JobPost, User
from applywise.routes.application_coach import read_application_coach


def test_application_coach_selects_weighted_leverage_and_projects_exact_gain() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="coach@example.com", full_name="Coach User")
        session.add(user)
        session.flush()
        job_post = JobPost(
            user_id=user.id,
            company_name="Coach Labs",
            title="Platform Intern",
            description="Build Kubernetes platform services.",
            required_skills=["Python", "Kubernetes"],
            nice_to_have_skills=["Docker"],
            responsibilities=["Build services"],
            seniority_level="Internship",
            domain="Backend",
            hidden_expectations=[],
            english_requirement="Working proficiency",
            technical_difficulty="Medium",
            business_expectations=[],
            communication_expectations=[],
            analysis_data={},
        )
        session.add(job_post)
        session.flush()
        fit_analysis = FitAnalysis(
            user_id=user.id,
            job_post_id=job_post.id,
            skill_score=50,
            project_relevance_score=50,
            experience_score=50,
            education_score=50,
            language_score=50,
            domain_score=50,
            profile_quality_score=50,
            total_score=58,
            breakdown={"signals": {"missing_required_skills": ["Kubernetes"]}},
        )
        session.add(fit_analysis)
        session.commit()
        session.refresh(user)
        session.refresh(job_post)
        session.refresh(fit_analysis)

        coach = build_application_coach(
            fit_analysis=fit_analysis,
            job_post=job_post,
        )
        route_response = read_application_coach(
            job_post.id,
            current_user=user,
            session=session,
        )

    assert coach.decision == "apply_after_targeted_fix"
    assert coach.should_apply_now is False
    assert coach.focus_component == "skill_score"
    assert coach.component_weight == 0.30
    assert coach.scenario_component_uplift == 20
    assert coach.estimated_point_improvement == 6
    assert coach.projected_fit_score == 64
    assert coach.action_code == "prove_missing_skill"
    assert coach.action_subject == "Kubernetes"
    assert "Kubernetes" in coach.highest_leverage_fix
    assert route_response == coach


def test_application_coach_recommends_immediate_application_at_threshold() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(email="ready@example.com")
        session.add(user)
        session.flush()
        job_post = JobPost(
            user_id=user.id,
            company_name="Ready Labs",
            title="Data Intern",
            description="Analyze product data.",
            required_skills=["SQL"],
            nice_to_have_skills=[],
            responsibilities=[],
            seniority_level="Internship",
            domain="Data",
            hidden_expectations=[],
            english_requirement=None,
            technical_difficulty="Medium",
            business_expectations=[],
            communication_expectations=[],
            analysis_data={},
        )
        session.add(job_post)
        session.flush()
        fit_analysis = FitAnalysis(
            user_id=user.id,
            job_post_id=job_post.id,
            skill_score=90,
            project_relevance_score=75,
            experience_score=75,
            education_score=80,
            language_score=80,
            domain_score=80,
            profile_quality_score=80,
            total_score=75,
            breakdown={},
        )
        session.add(fit_analysis)
        session.flush()

        coach = build_application_coach(
            fit_analysis=fit_analysis,
            job_post=job_post,
        )

    assert coach.decision == "apply_now"
    assert coach.should_apply_now is True
