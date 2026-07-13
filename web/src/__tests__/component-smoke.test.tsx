import { ApplicationDetail } from "@/app/applications/[id]/application-detail";
import { JobPostForm } from "@/app/jobs/new/job-post-form";
import { JobAnalysisView } from "@/app/jobs/[id]/analysis/job-analysis-view";
import { LoginForm } from "@/app/login/login-form";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { GoalManager } from "@/app/settings/goal-manager";
import { GitHubAnalyzer } from "@/app/projects/github-analyzer";
import { ProfileBuilder } from "@/app/profile/profile-builder";
import { ResumeManager } from "@/app/resume/resume-manager";
import type {
  ApplicationData,
  ApplicationCoachData,
  ApplicationEventData,
  CompanyProfileData,
  GitHubRepositoryData,
  InterviewPrepData,
  JobPostData,
  ProfileSnapshot,
  ResumeData,
  ResumeVersionData,
  SkillGraphData,
  UserGoalData,
} from "@/lib/api";

const apiBaseUrl = "http://localhost:8000";

const profileSnapshot: ProfileSnapshot = {
  profile: {
    id: "profile-1",
    education: "BS Computer Engineering",
    skills: ["Python", "FastAPI", "PostgreSQL", "React"],
    github_url: "https://github.com/applywise-demo",
    preferred_location: "Remote",
    internship_type: "Summer internship",
    languages: [{ name: "English", level: "B2" }],
    experience_level: "Student projects",
    target_roles: ["Backend Intern", "AI/ML Intern"],
  },
  projects: [
    {
      id: "project-1",
      name: "Fit Score API",
      description: "FastAPI service for internship fit analysis.",
      url: "https://github.com/applywise-demo/fit-score-api",
      skills: ["Python", "FastAPI", "PostgreSQL"],
    },
  ],
  target_role_options: ["Backend Intern", "AI/ML Intern"],
};

const resume: ResumeData = {
  id: "resume-1",
  filename: "demo-cv.pdf",
  content_text: "Python SQL FastAPI backend project experience.",
  parsed_data: {
    education: ["BS Computer Engineering"],
    experience: ["Backend internship project"],
    skills: ["Python", "SQL", "FastAPI"],
    projects: ["Internship tracker API"],
  },
  chunk_count: 1,
};

const resumeVersion: ResumeVersionData = {
  id: "resume-version-1",
  source_resume_id: "resume-1",
  source_filename: "demo-cv.pdf",
  name: "AI internship CV",
  target_role: "AI Intern",
  content_text: resume.content_text,
  parsed_data: resume.parsed_data,
  selected_application_count: 1,
};

const repository: GitHubRepositoryData = {
  id: "repo-1",
  owner: "applywise-demo",
  name: "fit-score-api",
  full_name: "applywise-demo/fit-score-api",
  html_url: "https://github.com/applywise-demo/fit-score-api",
  description: "FastAPI fit score service",
  language: "Python",
  stars: 7,
  default_branch: "main",
  last_commit_at: "2026-07-01T10:00:00Z",
  languages: { Python: 4500, Dockerfile: 200 },
  deterministic_signals: {
    has_tests: true,
    has_docker: true,
    has_ci: true,
    has_docs: true,
    has_deployment_config: true,
    readme_length: 1800,
    file_count: 8,
    directory_count: 4,
    language_count: 2,
    top_level_directories: ["api", "tests"],
  },
  analysis: {
    readme_quality: "Strong",
    tech_stack: ["Python", "FastAPI", "PostgreSQL", "Docker"],
    complexity: "Medium",
    commit_activity: "Recent",
    testing: "Tests detected",
    deployment: "Docker signal",
    architecture_signals: ["Modular API structure"],
    missing_documentation: ["Deployment walkthrough"],
    strengths: ["Clear backend structure"],
    weaknesses: ["Needs more architecture notes"],
    recommendations: ["Add screenshots"],
    best_fit_roles: ["Backend Intern"],
  },
  summary_text: "Python FastAPI PostgreSQL service with tests and Docker.",
  chunk_count: 1,
};

const jobPost: JobPostData = {
  id: "job-1",
  company_name: "Northstar AI",
  title: "AI/ML Intern",
  description: "Build Python services for model evaluation.",
  location: "Remote",
  url: "https://example.com/jobs/ai",
  required_skills: ["Python", "SQL", "Machine Learning"],
  nice_to_have_skills: ["Docker", "FastAPI"],
  responsibilities: ["Build evaluation tooling"],
  seniority_level: "Internship",
  domain: "AI/ML",
  hidden_expectations: ["Explain tradeoffs"],
  english_requirement: "Working proficiency",
  technical_difficulty: "Medium",
  business_expectations: ["Connect model quality to product outcomes"],
  communication_expectations: ["Document implementation decisions"],
  source: "component-test",
  analysis: {
    role_title: "AI/ML Intern",
    required_skills: ["Python", "SQL", "Machine Learning"],
    nice_to_have_skills: ["Docker", "FastAPI"],
    responsibilities: ["Build evaluation tooling"],
    seniority_level: "Internship",
    domain: "AI/ML",
    hidden_expectations: ["Explain tradeoffs"],
    english_requirement: "Working proficiency",
    technical_difficulty: "Medium",
    business_expectations: ["Connect model quality to product outcomes"],
    communication_expectations: ["Document implementation decisions"],
  },
  fit_analysis: {
    id: "fit-1",
    total_score: 78.5,
    components: {
      skill_score: 82,
      project_relevance_score: 76,
      experience_score: 70,
      education_score: 88,
      language_score: 85,
      domain_score: 74,
      profile_quality_score: 80,
    },
    breakdown: {
      weights: {
        skill_score: 0.3,
        project_relevance_score: 0.2,
        experience_score: 0.15,
        education_score: 0.1,
        language_score: 0.1,
        domain_score: 0.1,
        profile_quality_score: 0.05,
      },
    },
    explanation: {
      strong_matches: ["Python and SQL match the role."],
      weak_areas: ["Add more ML evaluation evidence."],
      recommended_action: "Apply after tightening the project summary.",
    },
  },
  roadmap: {
    id: "roadmap-1",
    title: "AI/ML Intern prep plan",
    duration_days: 7,
    job_post_id: "job-1",
    application_id: null,
    fit_analysis_id: "fit-1",
    target_role: "AI/ML Intern",
    plan: [
      {
        day: 1,
        date: "2026-07-07",
        focus: "Machine Learning evaluation",
        tasks: ["Review precision, recall, and validation tradeoffs."],
        outcome: "Explain one model evaluation example.",
      },
    ],
    missing_skills: [
      {
        rank: 1,
        name: "Machine Learning evaluation",
        impact_score: 90,
        reason: "Required by the role and lightly evidenced in the profile.",
      },
    ],
  },
};

const skillGraph: SkillGraphData = {
  job_post_id: "job-1",
  target_role: "AI/ML Intern",
  readiness_percent: 33.33,
  known_skills: ["Python", "SQL"],
  target_skills: ["Python", "Machine Learning", "Docker"],
  recommended_sequence: ["Machine Learning", "Linux", "Docker"],
  paths: [
    {
      target_skill: "Machine Learning",
      ready: false,
      nodes: [
        { name: "Python", status: "known" },
        { name: "Machine Learning", status: "target" },
      ],
    },
  ],
};

const applicationCoach: ApplicationCoachData = {
  job_post_id: "job-1",
  decision: "apply_after_targeted_fix",
  should_apply_now: false,
  current_fit_score: 78.5,
  projected_fit_score: 84.5,
  focus_component: "skill_score",
  focus_component_label: "Skill match",
  current_component_score: 82,
  component_weight: 0.3,
  scenario_component_uplift: 18,
  estimated_point_improvement: 5.4,
  action_code: "prove_missing_skill",
  action_subject: "Machine Learning evaluation",
  highest_leverage_fix: "Build and verify Machine Learning evaluation evidence.",
  decision_reason: "Complete the highest-leverage fix, then apply.",
  estimate_basis: "deterministic_one_fix_scenario",
};

const application: ApplicationData = {
  id: "application-1",
  job_post_id: "job-1",
  fit_analysis_id: "fit-1",
  interview_prep_id: "prep-1",
  resume_version_id: "resume-version-1",
  resume_version_name: "AI internship CV",
  resume_version_target_role: "AI Intern",
  company: "Northstar AI",
  role: "AI/ML Intern",
  status: "preparing",
  deadline: "2026-08-01",
  job_url: "https://example.com/jobs/ai",
  fit_score: 78.5,
  fit_components: jobPost.fit_analysis?.components ?? null,
  fit_explanation: jobPost.fit_analysis?.explanation ?? null,
  missing_skills: ["Machine Learning evaluation"],
  applied_date: null,
  interview_date: null,
  notes: "Tailor project examples before applying.",
  next_action: "Apply by Friday",
  updated_at: "2026-07-06T10:00:00Z",
};

const applicationEvents: ApplicationEventData[] = [
  {
    id: "event-1",
    event_type: "created",
    from_status: null,
    to_status: "saved",
    event_data: {},
    created_at: "2026-07-06T10:00:00Z",
  },
];

const userGoal: UserGoalData = {
  id: "goal-1",
  title: "Build a focused internship pipeline",
  target_role: "Backend Intern",
  target_date: "2026-08-15",
  weekly_application_target: 5,
  status: "active",
  weekly_progress: 2,
  progress_percent: 40,
  days_remaining: 33,
  updated_at: "2026-07-13T08:00:00Z",
};

const companyProfile: CompanyProfileData = {
  id: "company-profile-1",
  job_post_id: "job-1",
  company_name: "Northstar AI",
  role: "AI/ML Intern",
  evidence_basis: "job_post_and_candidate_evidence",
  what_company_does: "The supplied job post describes model evaluation tooling.",
  likely_interview_angles: ["Model evaluation tradeoffs", "Python service design"],
  projects_to_emphasize: [
    {
      name: "Fit Score API",
      reason: "It provides relevant API and evaluation evidence.",
      talking_points: ["Explain deterministic scoring", "Show validation tests"],
    },
  ],
  smart_questions: [
    "How is intern success measured?",
    "Which evaluation workflow would the intern own first?",
    "How does the team review model-quality decisions?",
  ],
  updated_at: "2026-07-13T08:00:00Z",
};

const interviewPrep: InterviewPrepData = {
  id: "prep-1",
  application: {
    id: "application-1",
    status: "preparing",
    job_post_id: "job-1",
  },
  job: {
    id: "job-1",
    company_name: "Northstar AI",
    title: "AI/ML Intern",
    domain: "AI/ML",
    required_skills: ["Python", "SQL", "Machine Learning"],
    nice_to_have_skills: ["Docker", "FastAPI"],
  },
  focus_areas: ["Python", "Model evaluation"],
  content: {
    technical_questions: [
      {
        question: "How would you evaluate a recommendation model?",
        guidance: "Use validation metrics and business impact.",
        grounded_evidence: ["Fit Score API project"],
        related_skills: ["Python", "Machine Learning"],
      },
    ],
    behavioral_questions: [
      {
        question: "Tell me about a time you learned a new tool quickly.",
        guidance: "Use a STAR answer grounded in the backend project.",
        grounded_evidence: ["FastAPI project"],
        related_skills: ["Communication"],
      },
    ],
    english_self_introduction: {
      content: "I am a computer engineering student focused on backend and AI systems.",
      grounded_evidence: ["Profile target roles"],
    },
    project_explanation_script: {
      content: "My fit score API evaluates internship matches using deterministic signals.",
      grounded_evidence: ["Fit Score API project"],
    },
    why_this_company: {
      content: "Northstar AI fits my interest in practical model evaluation.",
      grounded_evidence: ["Job requirements"],
    },
    why_this_role: {
      content: "The role combines Python, SQL, and model evaluation.",
      grounded_evidence: ["Matched skills"],
    },
    star_answer_templates: [
      {
        prompt: "Describe a technical challenge.",
        situation: "A project needed repeatable scoring.",
        task: "Design a deterministic fit engine.",
        action: "Implemented weighted components and tests.",
        result: "The system produced explainable scores.",
        grounded_evidence: ["Fit score implementation"],
      },
    ],
    weak_area_drill_questions: [
      {
        question: "How do you choose model evaluation metrics?",
        guidance: "Tie metric choice to product risk and data shape.",
        grounded_evidence: ["Missing skills roadmap"],
        related_skills: ["Machine Learning evaluation"],
      },
    ],
  },
};

export function ComponentSmokeCases() {
  return (
    <>
      <LoginForm
        callbackUrl="/dashboard"
        emailEnabled={false}
        githubEnabled={false}
        googleEnabled
      />
      <OnboardingForm
        apiBaseUrl={apiBaseUrl}
        initialResume={resume}
        initialSnapshot={profileSnapshot}
        nextPath="/dashboard"
        userName="Demo User"
      />
      <ProfileBuilder
        apiBaseUrl={apiBaseUrl}
        initialSnapshot={profileSnapshot}
      />
      <ResumeManager
        apiBaseUrl={apiBaseUrl}
        initialResume={resume}
        initialResumeVersions={[resumeVersion]}
      />
      <GitHubAnalyzer
        apiBaseUrl={apiBaseUrl}
        initialRepositories={[repository]}
      />
      <JobPostForm apiBaseUrl={apiBaseUrl} />
      <GoalManager apiBaseUrl={apiBaseUrl} initialGoals={[userGoal]} />
      <JobAnalysisView
        apiBaseUrl={apiBaseUrl}
        applicationCoach={applicationCoach}
        jobPost={jobPost}
        roadmapDays={7}
        skillGraph={skillGraph}
      />
      <ApplicationDetail
        apiBaseUrl={apiBaseUrl}
        initialApplication={application}
        initialApplicationEvents={applicationEvents}
        initialCompanyProfile={companyProfile}
        initialInterviewPrep={interviewPrep}
        initialResumeVersions={[resumeVersion]}
      />
    </>
  );
}

export const componentSmokeTree = <ComponentSmokeCases />;
