import { redirect } from "next/navigation";

import { getProfileSnapshot, getResume } from "@/lib/api";
import { isOnboardingComplete, safeOnboardingDestination } from "@/lib/onboarding";
import { getBackendSession } from "@/lib/server-auth";

type StartPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function StartPage({ searchParams }: StartPageProps) {
  const params = await searchParams;
  const destination = safeOnboardingDestination(params.next);
  const session = await getBackendSession();

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  }

  // Keep these sequential so the first request provisions a brand-new backend user.
  const snapshot = await getProfileSnapshot(session);
  const resume = await getResume(session);

  if (isOnboardingComplete(snapshot, resume)) {
    redirect(destination);
  }

  redirect(`/onboarding?next=${encodeURIComponent(destination)}`);
}
