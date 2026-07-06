import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { JobAnalysisView } from "@/app/jobs/[id]/analysis/job-analysis-view";
import { getJobPost } from "@/lib/api";
import { authOptions } from "@/lib/auth";

type JobAnalysisPageProps = {
  params: {
    id: string;
  };
};

export default async function JobAnalysisPage({ params }: JobAnalysisPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect(`/login?callbackUrl=/jobs/${params.id}/analysis`);
  }

  const jobPost = await getJobPost(session, params.id);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <JobAnalysisView jobPost={jobPost} />
      </section>
    </main>
  );
}
