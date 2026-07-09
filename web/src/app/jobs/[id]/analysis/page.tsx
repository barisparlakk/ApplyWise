import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { JobAnalysisView } from "@/app/jobs/[id]/analysis/job-analysis-view";
import { AppShell } from "@/components/app-shell";
import { getJobPost } from "@/lib/api";
import { authOptions } from "@/lib/auth";

type JobAnalysisPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    days?: string;
  }>;
};

export default async function JobAnalysisPage({ params, searchParams }: JobAnalysisPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const query = await searchParams;
  const roadmapDays = parseRoadmapDays(query.days);

  if (!session?.backendToken) {
    redirect(`/login?callbackUrl=/jobs/${id}/analysis`);
  }

  const jobPost = await getJobPost(session, id, roadmapDays);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <JobAnalysisView
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
          backendToken={session.backendToken}
          jobPost={jobPost}
          roadmapDays={roadmapDays}
        />
      </section>
    </AppShell>
  );
}

function parseRoadmapDays(value: string | undefined) {
  const days = Number(value);
  return days === 7 || days === 14 ? days : 3;
}
