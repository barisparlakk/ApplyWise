import { redirect } from "next/navigation";

import { ApplicationsWorkspace } from "@/app/applications/application-workspace";
import { AppShell } from "@/components/app-shell";
import { getApplications } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

export default async function ApplicationsPage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/applications");
  }

  const applications = await getApplications(session);

  return (
    <AppShell>
      <ApplicationsWorkspace applications={applications} />
    </AppShell>
  );
}
