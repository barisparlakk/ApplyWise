import "server-only";

import type { BackendSession } from "@/lib/server-auth";

export type CurrentUser = {
  id: string;
  email: string;
  full_name: string | null;
};

export type ProfileData = {
  id: string | null;
  education: string | null;
  github_url: string | null;
  target_roles: string[];
  preferred_location: string | null;
  internship_type: string | null;
  languages: Array<{
    name: string;
    level: string;
  }>;
  experience_level: string | null;
  skills: string[];
};

export type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  skills: string[];
};

export type ProfileSnapshot = {
  profile: ProfileData;
  projects: ProjectData[];
  target_role_options: string[];
};

export type ParsedResumeData = {
  education: string[];
  experience: string[];
  skills: string[];
  projects: string[];
};

export type ResumeData = {
  id: string;
  filename: string;
  content_text: string;
  parsed_data: ParsedResumeData;
  chunk_count: number;
};

export type ResumeVersionData = {
  id: string;
  source_resume_id: string | null;
  source_filename: string | null;
  name: string;
  target_role: string;
  content_text: string;
  parsed_data: ParsedResumeData;
  selected_application_count: number;
};

export type GitHubDeterministicSignals = {
  readme_length: number;
  has_tests: boolean;
  has_docker: boolean;
  has_ci: boolean;
  has_docs: boolean;
  has_deployment_config: boolean;
  file_count: number;
  directory_count: number;
  language_count: number;
  top_level_directories: string[];
};

export type GitHubRepositoryAnalysis = {
  readme_quality: string;
  tech_stack: string[];
  complexity: string;
  commit_activity: string;
  testing: string;
  deployment: string;
  architecture_signals: string[];
  missing_documentation: string[];
  best_fit_roles: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export type GitHubRepositoryData = {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stars: number;
  default_branch: string | null;
  last_commit_at: string | null;
  languages: Record<string, number>;
  deterministic_signals: GitHubDeterministicSignals;
  analysis: GitHubRepositoryAnalysis;
  summary_text: string | null;
  chunk_count: number;
};

export type JobPostAnalysis = {
  role_title: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
  seniority_level: string;
  domain: string;
  hidden_expectations: string[];
  english_requirement: string;
  technical_difficulty: string;
  business_expectations: string[];
  communication_expectations: string[];
};

export type FitAnalysisComponents = {
  skill_score: number;
  project_relevance_score: number;
  experience_score: number;
  education_score: number;
  language_score: number;
  domain_score: number;
  profile_quality_score: number;
};

export type FitExplanation = {
  strong_matches: string[];
  weak_areas: string[];
  recommended_action: string;
};

export type FitAnalysisData = {
  id: string;
  components: FitAnalysisComponents;
  total_score: number;
  explanation: FitExplanation;
  breakdown: Record<string, unknown>;
};

export type ApplicationCoachDecision =
  | "apply_now"
  | "apply_after_targeted_fix"
  | "build_evidence_first";

export type ApplicationCoachActionCode =
  | "prove_missing_skill"
  | "strengthen_project"
  | "quantify_experience"
  | "clarify_education"
  | "document_language"
  | "align_domain"
  | "complete_profile"
  | "maintain_evidence";

export type ApplicationCoachData = {
  job_post_id: string;
  decision: ApplicationCoachDecision;
  should_apply_now: boolean;
  current_fit_score: number;
  projected_fit_score: number;
  focus_component: keyof FitAnalysisComponents;
  focus_component_label: string;
  current_component_score: number;
  component_weight: number;
  scenario_component_uplift: number;
  estimated_point_improvement: number;
  action_code: ApplicationCoachActionCode;
  action_subject: string;
  highest_leverage_fix: string;
  decision_reason: string;
  estimate_basis: "deterministic_one_fix_scenario";
};

export type MissingSkillData = {
  rank: number;
  name: string;
  impact_score: number;
  reason: string;
};

export type RoadmapDayData = {
  day: number;
  date: string;
  focus: string;
  tasks: string[];
  outcome: string;
};

export type RoadmapData = {
  id: string;
  title: string;
  duration_days: number;
  job_post_id: string | null;
  application_id: string | null;
  fit_analysis_id: string | null;
  target_role: string;
  missing_skills: MissingSkillData[];
  plan: RoadmapDayData[];
};

export type SkillPathNodeData = {
  name: string;
  status: "known" | "missing" | "target";
};

export type SkillReadinessPathData = {
  target_skill: string;
  ready: boolean;
  nodes: SkillPathNodeData[];
};

export type SkillGraphData = {
  job_post_id: string;
  target_role: string;
  readiness_percent: number;
  known_skills: string[];
  target_skills: string[];
  recommended_sequence: string[];
  paths: SkillReadinessPathData[];
};

export type JobPostData = {
  id: string;
  company_name: string;
  title: string;
  description: string;
  location: string | null;
  url: string | null;
  source: string | null;
  required_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
  seniority_level: string | null;
  domain: string | null;
  hidden_expectations: string[];
  english_requirement: string | null;
  technical_difficulty: string | null;
  business_expectations: string[];
  communication_expectations: string[];
  analysis: JobPostAnalysis;
  fit_analysis: FitAnalysisData | null;
  roadmap: RoadmapData | null;
};

export type ApplicationStatus =
  | "saved"
  | "preparing"
  | "applied"
  | "assessment"
  | "interview"
  | "rejected"
  | "offer"
  | "archived";

export type ApplicationData = {
  id: string;
  job_post_id: string;
  fit_analysis_id: string | null;
  interview_prep_id: string | null;
  resume_version_id: string | null;
  resume_version_name: string | null;
  resume_version_target_role: string | null;
  company: string;
  role: string;
  status: ApplicationStatus;
  deadline: string | null;
  job_url: string | null;
  fit_score: number | null;
  fit_components: FitAnalysisComponents | null;
  fit_explanation: FitExplanation | null;
  missing_skills: string[];
  applied_date: string | null;
  interview_date: string | null;
  notes: string | null;
  next_action: string | null;
  updated_at: string;
};

export type ApplicationEventData = {
  id: string;
  event_type: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus | null;
  event_data: Record<string, unknown>;
  created_at: string;
};

export type UserGoalData = {
  id: string;
  title: string;
  target_role: string | null;
  target_date: string | null;
  weekly_application_target: number;
  status: "active" | "completed" | "archived";
  weekly_progress: number;
  progress_percent: number;
  days_remaining: number | null;
  updated_at: string;
};

export type InterviewPrepQuestion = {
  question: string;
  guidance: string;
  grounded_evidence: string[];
  related_skills: string[];
};

export type InterviewPrepScript = {
  content: string;
  grounded_evidence: string[];
};

export type InterviewPrepStarTemplate = {
  prompt: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  grounded_evidence: string[];
};

export type InterviewPrepContent = {
  technical_questions: InterviewPrepQuestion[];
  behavioral_questions: InterviewPrepQuestion[];
  english_self_introduction: InterviewPrepScript;
  project_explanation_script: InterviewPrepScript;
  why_this_company: InterviewPrepScript;
  why_this_role: InterviewPrepScript;
  star_answer_templates: InterviewPrepStarTemplate[];
  weak_area_drill_questions: InterviewPrepQuestion[];
};

export type InterviewPrepData = {
  id: string;
  application: {
    id: string;
    status: string;
    job_post_id: string;
  };
  job: {
    id: string;
    company_name: string;
    title: string;
    domain: string | null;
    required_skills: string[];
    nice_to_have_skills: string[];
  };
  focus_areas: string[];
  content: InterviewPrepContent;
};

export type CompanyProjectEmphasis = {
  name: string;
  reason: string;
  talking_points: string[];
};

export type CompanyProfileData = {
  id: string;
  job_post_id: string;
  company_name: string;
  role: string;
  evidence_basis: "job_post_and_candidate_evidence";
  what_company_does: string;
  likely_interview_angles: string[];
  projects_to_emphasize: CompanyProjectEmphasis[];
  smart_questions: string[];
  updated_at: string;
};

export type InterviewPrepSection =
  | "technical_questions"
  | "behavioral_questions"
  | "english_self_introduction"
  | "project_explanation_script"
  | "why_this_company"
  | "why_this_role"
  | "star_answer_templates"
  | "weak_area_drill_questions";

export async function getCurrentUser(session: BackendSession): Promise<CurrentUser> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected session: ${response.status}`);
  }

  return (await response.json()) as CurrentUser;
}

export async function getProfileSnapshot(session: BackendSession): Promise<ProfileSnapshot> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/profile`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected profile request: ${response.status}`);
  }

  return (await response.json()) as ProfileSnapshot;
}

export async function getResume(session: BackendSession): Promise<ResumeData | null> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/resume`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected resume request: ${response.status}`);
  }

  return (await response.json()) as ResumeData | null;
}

export async function getResumeVersions(
  session: BackendSession,
): Promise<ResumeVersionData[]> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/resume/versions`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected resume versions request: ${response.status}`);
  }

  return (await response.json()) as ResumeVersionData[];
}

export async function getGitHubRepositories(
  session: BackendSession,
): Promise<GitHubRepositoryData[]> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/github/repositories`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected GitHub repositories request: ${response.status}`);
  }

  return (await response.json()) as GitHubRepositoryData[];
}

export async function getJobPost(
  session: BackendSession,
  jobPostId: string,
  roadmapDays = 3,
): Promise<JobPostData> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/jobs/${jobPostId}?roadmap_days=${roadmapDays}`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected job request: ${response.status}`);
  }

  return (await response.json()) as JobPostData;
}

export async function getRoadmaps(
  session: BackendSession,
  durationDays = 3,
): Promise<RoadmapData[]> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/roadmap?duration_days=${durationDays}`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected roadmap request: ${response.status}`);
  }

  return (await response.json()) as RoadmapData[];
}

export async function getSkillGraph(
  session: BackendSession,
  jobPostId: string,
): Promise<SkillGraphData> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/skill-graph/jobs/${jobPostId}`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected skill graph request: ${response.status}`);
  }

  return (await response.json()) as SkillGraphData;
}

export async function getApplicationCoach(
  session: BackendSession,
  jobPostId: string,
): Promise<ApplicationCoachData> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/coach/jobs/${jobPostId}`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected application coach request: ${response.status}`);
  }

  return (await response.json()) as ApplicationCoachData;
}

export async function getApplications(session: BackendSession): Promise<ApplicationData[]> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/applications`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected applications request: ${response.status}`);
  }

  return (await response.json()) as ApplicationData[];
}

export async function getApplication(
  session: BackendSession,
  applicationId: string,
): Promise<ApplicationData> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/applications/${applicationId}`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected application request: ${response.status}`);
  }

  return (await response.json()) as ApplicationData;
}

export async function getApplicationEvents(
  session: BackendSession,
  applicationId: string,
): Promise<ApplicationEventData[]> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/applications/${applicationId}/events`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected application events request: ${response.status}`);
  }

  return (await response.json()) as ApplicationEventData[];
}

export async function getGoals(session: BackendSession): Promise<UserGoalData[]> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/goals`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected goals request: ${response.status}`);
  }

  return (await response.json()) as UserGoalData[];
}

export async function getCompanyProfile(
  session: BackendSession,
  jobPostId: string,
): Promise<CompanyProfileData | null> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/company-profiles/job/${jobPostId}`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected company profile request: ${response.status}`);
  }

  return (await response.json()) as CompanyProfileData | null;
}

export async function getInterviewPrep(
  session: BackendSession,
  applicationId: string,
): Promise<InterviewPrepData> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const requestHeaders = {
    Authorization: `Bearer ${session.backendToken}`,
  };
  let response = await fetch(`${baseUrl}/interview-prep/${applicationId}`, {
    headers: requestHeaders,
    cache: "no-store",
  });

  if (response.status === 404) {
    response = await fetch(`${baseUrl}/interview-prep/${applicationId}`, {
      method: "POST",
      headers: requestHeaders,
      cache: "no-store",
    });
  }

  if (!response.ok) {
    throw new Error(`Backend rejected interview prep request: ${response.status}`);
  }

  return (await response.json()) as InterviewPrepData;
}
