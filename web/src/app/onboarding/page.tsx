import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { getProfileSnapshot, getResume } from "@/lib/api";
import { isOnboardingComplete, safeOnboardingDestination } from "@/lib/onboarding";
import { getBackendSession } from "@/lib/server-auth";

type OnboardingPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const destination = safeOnboardingDestination(params.next);
  const session = await getBackendSession();

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  }

  const snapshot = await getProfileSnapshot(session);
  const resume = await getResume(session);

  if (isOnboardingComplete(snapshot, resume)) {
    redirect(destination);
  }

  return (
    <OnboardingForm
      apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
      initialResume={resume}
      initialSnapshot={snapshot}
      nextPath={destination}
      userName={session.user?.name ?? null}
    />
  );
}
