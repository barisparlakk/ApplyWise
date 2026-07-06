import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { JobAnalysisView } from "@/app/jobs/[id]/analysis/job-analysis-view";
import { getJobPost } from "@/lib/api";
import { authOptions } from "@/lib/auth";

type JobAnalysisPageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    days?: string;
  };
};

export default async function JobAnalysisPage({ params, searchParams }: JobAnalysisPageProps) {
  const session = await getServerSession(authOptions);
  const roadmapDays = parseRoadmapDays(searchParams?.days);

  if (!session?.backendToken) {
    redirect(`/login?callbackUrl=/jobs/${params.id}/analysis`);
  }

  const jobPost = await getJobPost(session, params.id, roadmapDays);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <JobAnalysisView jobPost={jobPost} roadmapDays={roadmapDays} />
      </section>
    </main>
  );
}

function parseRoadmapDays(value: string | undefined) {
  const days = Number(value);
  return days === 7 || days === 14 ? days : 3;
}
