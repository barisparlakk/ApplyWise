import { redirect } from "next/navigation";

import { ResumeManager } from "@/app/resume/resume-manager";
import { AppShell } from "@/components/app-shell";
import { getResume } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

export default async function ResumePage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/resume");
  }

  const resume = await getResume(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <ResumeManager
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
          initialResume={resume}
        />
      </section>
    </AppShell>
  );
}
