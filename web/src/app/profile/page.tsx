import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ProfileBuilder } from "@/app/profile/profile-builder";
import { AppShell } from "@/components/app-shell";
import { getProfileSnapshot } from "@/lib/api";
import { authOptions } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/profile");
  }

  const snapshot = await getProfileSnapshot(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <ProfileBuilder
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
          backendToken={session.backendToken}
          initialSnapshot={snapshot}
        />
      </section>
    </AppShell>
  );
}
