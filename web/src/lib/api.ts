import type { Session } from "next-auth";

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

export type ApplicationData = {
  id: string;
  job_post_id: string;
  status: string;
  notes: string | null;
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

export type InterviewPrepSection =
  | "technical_questions"
  | "behavioral_questions"
  | "english_self_introduction"
  | "project_explanation_script"
  | "why_this_company"
  | "why_this_role"
  | "star_answer_templates"
  | "weak_area_drill_questions";

export async function getCurrentUser(session: Session): Promise<CurrentUser> {
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

export async function getProfileSnapshot(session: Session): Promise<ProfileSnapshot> {
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

export async function getResume(session: Session): Promise<ResumeData | null> {
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

export async function getGitHubRepositories(session: Session): Promise<GitHubRepositoryData[]> {
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
  session: Session,
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

export async function getRoadmaps(session: Session, durationDays = 3): Promise<RoadmapData[]> {
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

export async function getInterviewPrep(
  session: Session,
  applicationId: string,
): Promise<InterviewPrepData> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  if (!session.backendToken) {
    throw new Error("Missing backend token.");
  }

  const response = await fetch(`${baseUrl}/interview-prep/${applicationId}`, {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend rejected interview prep request: ${response.status}`);
  }

  return (await response.json()) as InterviewPrepData;
}
