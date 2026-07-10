import { redirect } from "next/navigation";

import { JobPostForm } from "@/app/jobs/new/job-post-form";
import { AppShell } from "@/components/app-shell";
import { getBackendSession } from "@/lib/server-auth";

export default async function NewJobPage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/jobs/new");
  }

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl">
        <JobPostForm apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"} />
      </section>
    </AppShell>
  );
}
