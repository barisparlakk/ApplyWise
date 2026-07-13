import { redirect } from "next/navigation";

import { ApplicationDetail } from "@/app/applications/[id]/application-detail";
import { AppShell } from "@/components/app-shell";
import {
  getApplication,
  getCompanyProfile,
  getInterviewPrep,
  getResumeVersions,
} from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

type ApplicationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const session = await getBackendSession();

  if (!session) {
    redirect(`/login?callbackUrl=/applications/${id}`);
  }

  const application = await getApplication(session, id);
  const [interviewPrep, resumeVersions, companyProfile] = await Promise.all([
    getInterviewPrep(session, id),
    getResumeVersions(session),
    getCompanyProfile(session, application.job_post_id),
  ]);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-[1400px]">
        <ApplicationDetail
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
          initialApplication={application}
          initialInterviewPrep={interviewPrep}
          initialResumeVersions={resumeVersions}
          initialCompanyProfile={companyProfile}
        />
      </section>
    </AppShell>
  );
}
