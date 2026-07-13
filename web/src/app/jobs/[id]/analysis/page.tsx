import { redirect } from "next/navigation";

import { JobAnalysisView } from "@/app/jobs/[id]/analysis/job-analysis-view";
import { AppShell } from "@/components/app-shell";
import { getJobPost, getSkillGraph } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

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
  const session = await getBackendSession();
  const query = await searchParams;
  const roadmapDays = parseRoadmapDays(query.days);

  if (!session) {
    redirect(`/login?callbackUrl=/jobs/${id}/analysis`);
  }

  const [jobPost, skillGraph] = await Promise.all([
    getJobPost(session, id, roadmapDays),
    getSkillGraph(session, id),
  ]);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-[1400px]">
        <JobAnalysisView
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
          jobPost={jobPost}
          roadmapDays={roadmapDays}
          skillGraph={skillGraph}
        />
      </section>
    </AppShell>
  );
}

function parseRoadmapDays(value: string | undefined) {
  const days = Number(value);
  return days === 7 || days === 14 ? days : 3;
}
