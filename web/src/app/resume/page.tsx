import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ResumeManager } from "@/app/resume/resume-manager";
import { getResume } from "@/lib/api";
import { authOptions } from "@/lib/auth";

export default async function ResumePage() {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/resume");
  }

  const resume = await getResume(session);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <ResumeManager
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
          backendToken={session.backendToken}
          initialResume={resume}
        />
      </section>
    </main>
  );
}
