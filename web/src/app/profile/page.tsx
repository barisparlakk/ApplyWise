import { redirect } from "next/navigation";

import { ProfileBuilder } from "@/app/profile/profile-builder";
import { AppShell } from "@/components/app-shell";
import { getProfileSnapshot } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

export default async function ProfilePage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/profile");
  }

  const snapshot = await getProfileSnapshot(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <ProfileBuilder
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
          initialSnapshot={snapshot}
        />
      </section>
    </AppShell>
  );
}
