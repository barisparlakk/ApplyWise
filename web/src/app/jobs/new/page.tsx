import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { JobPostForm } from "@/app/jobs/new/job-post-form";
import { authOptions } from "@/lib/auth";

export default async function NewJobPage() {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/jobs/new");
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        <JobPostForm
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
          backendToken={session.backendToken}
        />
      </section>
    </main>
  );
}
