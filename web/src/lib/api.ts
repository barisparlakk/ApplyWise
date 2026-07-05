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
