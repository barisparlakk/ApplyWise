import type { Session } from "next-auth";

export type CurrentUser = {
  id: string;
  email: string;
  full_name: string | null;
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
