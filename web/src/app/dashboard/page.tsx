import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import type { ApplicationData } from "@/lib/api";
import { getApplications, getCurrentUser } from "@/lib/api";
import { authOptions } from "@/lib/auth";

const ACTIVE_STATUSES = new Set(["saved", "preparing", "applied", "assessment", "interview"]);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const user = await getCurrentUser(session);
  const applications = await getApplications(session);
  const activeApplications = applications.filter((application) =>
    ACTIVE_STATUSES.has(application.status),
  );
  const recentFitScores = applications
    .filter((application) => application.fit_score !== null)
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              Welcome back, {user.full_name ?? user.email}.
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
              href="/profile"
            >
              Profile
            </Link>
            <Link
              className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
              href="/resume"
            >
              Resume
            </Link>
            <Link
              className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
              href="/projects"
            >
              Projects
            </Link>
            <Link
              className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
              href="/jobs/new"
            >
              Jobs
            </Link>
            <Link
              className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
              href="/applications"
            >
              Applications
            </Link>
            <Link
              className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
              href="/roadmap"
            >
              Roadmap
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Active applications</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {activeApplications.length}
            </p>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Tracked applications</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{applications.length}</p>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Average fit</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {formatAverageFit(applications)}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Recent fit scores</h2>
            <Link className="text-sm font-medium text-foreground hover:underline" href="/applications">
              View tracker
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentFitScores.length ? (
              recentFitScores.map((application) => (
                <Link
                  className="grid gap-3 rounded-md border border-border px-4 py-3 sm:grid-cols-[1fr_auto]"
                  href={`/applications/${application.id}`}
                  key={application.id}
                >
                  <div>
                    <p className="font-medium text-foreground">{application.company}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{application.role}</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {formatScore(application.fit_score)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Analyze and save an application to see recent fit scores.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function formatAverageFit(applications: ApplicationData[]) {
  const scores = applications
    .map((application) => application.fit_score)
    .filter((score): score is number => score !== null);
  if (!scores.length) {
    return "-";
  }
  const average = scores.reduce((total, score) => total + score, 0) / scores.length;
  return `${Math.round(average)}%`;
}

function formatScore(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`;
}
