import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ApplicationDetail } from "@/app/applications/[id]/application-detail";
import { getApplication } from "@/lib/api";
import { authOptions } from "@/lib/auth";

type ApplicationDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect(`/login?callbackUrl=/applications/${params.id}`);
  }

  const application = await getApplication(session, params.id);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <ApplicationDetail
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
          backendToken={session.backendToken}
          initialApplication={application}
        />
      </section>
    </main>
  );
}
