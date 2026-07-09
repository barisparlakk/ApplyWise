import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { InterviewPrepView } from "@/app/interview-prep/[id]/interview-prep-view";
import { AppShell } from "@/components/app-shell";
import { getInterviewPrep } from "@/lib/api";
import { authOptions } from "@/lib/auth";

type InterviewPrepPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InterviewPrepPage({ params }: InterviewPrepPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect(`/login?callbackUrl=/interview-prep/${id}`);
  }

  const prep = await getInterviewPrep(session, id);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <InterviewPrepView
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
          backendToken={session.backendToken}
          initialPrep={prep}
        />
      </section>
    </AppShell>
  );
}
