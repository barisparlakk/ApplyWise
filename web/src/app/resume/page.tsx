import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ResumeManager } from "@/app/resume/resume-manager";
import { AppShell } from "@/components/app-shell";
import { getResume } from "@/lib/api";
import { authOptions } from "@/lib/auth";

export default async function ResumePage() {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/resume");
  }

  const resume = await getResume(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <ResumeManager
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
          backendToken={session.backendToken}
          initialResume={resume}
        />
      </section>
    </AppShell>
  );
}
