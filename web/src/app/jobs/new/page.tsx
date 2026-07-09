import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { JobPostForm } from "@/app/jobs/new/job-post-form";
import { AppShell } from "@/components/app-shell";
import { authOptions } from "@/lib/auth";

export default async function NewJobPage() {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/jobs/new");
  }

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl">
        <JobPostForm
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
          backendToken={session.backendToken}
        />
      </section>
    </AppShell>
  );
}
