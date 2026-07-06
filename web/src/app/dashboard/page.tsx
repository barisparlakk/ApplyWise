import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import type { ApplicationData } from "@/lib/api";
import { getApplications, getCurrentUser } from "@/lib/api";
import { authOptions } from "@/lib/auth";

const ACTIVE_STATUSES = new Set(["saved", "preparing", "applied", "assessment", "interview"]);
const CLOSED_STATUSES = new Set(["rejected", "offer", "archived"]);

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
  const today = new Date().toISOString().slice(0, 10);
  const upcomingDeadlines = applications
    .filter(
      (application) =>
        application.deadline &&
        application.deadline >= today &&
        !CLOSED_STATUSES.has(application.status),
    )
    .sort((left, right) => String(left.deadline).localeCompare(String(right.deadline)))
    .slice(0, 4);
  const topMissingSkills = rankMissingSkills(applications).slice(0, 6);
  const nextBestActions = buildNextBestActions(applications).slice(0, 5);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              Welcome back, {user.full_name ?? user.email}.
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <p className="mt-2 text-sm text-muted-foreground">Saved through interview stages</p>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Upcoming deadlines</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {upcomingDeadlines.length}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Open applications with dates</p>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Average fit</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {formatAverageFit(applications)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Across analyzed targets</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-md border border-border bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-foreground">Upcoming deadlines</h2>
              <Link
                className="text-sm font-medium text-foreground hover:underline"
                href="/applications"
              >
                View tracker
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {upcomingDeadlines.length ? (
                upcomingDeadlines.map((application) => (
                  <Link
                    className="grid gap-3 rounded-md border border-border px-4 py-3 sm:grid-cols-[1fr_auto]"
                    href={`/applications/${application.id}`}
                    key={application.id}
                  >
                    <div>
                      <p className="font-medium text-foreground">{application.company}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{application.role}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatDate(application.deadline)}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState text="No upcoming deadlines. Add dates on tracked applications." />
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-white p-5">
            <h2 className="text-lg font-semibold text-foreground">Top missing skills</h2>
            <div className="mt-4 space-y-3">
              {topMissingSkills.length ? (
                topMissingSkills.map((skill) => (
                  <div className="rounded-md border border-border px-4 py-3" key={skill.name}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{skill.name}</p>
                      <p className="text-xs text-muted-foreground">{skill.count} targets</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="No missing-skill signals yet. Analyze and save a job first." />
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-white p-5">
            <h2 className="text-lg font-semibold text-foreground">Next-best actions</h2>
            <div className="mt-4 space-y-3">
              {nextBestActions.length ? (
                nextBestActions.map((item) => (
                  <Link
                    className="block rounded-md border border-border px-4 py-3 hover:border-primary"
                    href={`/applications/${item.application.id}`}
                    key={`${item.application.id}-${item.action}`}
                  >
                    <p className="text-sm font-semibold text-foreground">{item.action}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.application.company} - {item.application.role}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState text="No immediate action. Save applications to build your queue." />
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-foreground">Recent fit scores</h2>
              <Link
                className="text-sm font-medium text-foreground hover:underline"
                href="/applications"
              >
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
                <EmptyState text="Analyze and save an application to see recent fit scores." />
              )}
            </div>
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

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function rankMissingSkills(applications: ApplicationData[]) {
  const counts = new Map<string, number>();
  applications.forEach((application) => {
    application.missing_skills.forEach((skill) => {
      counts.set(skill, (counts.get(skill) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function buildNextBestActions(applications: ApplicationData[]) {
  return applications
    .filter((application) => !CLOSED_STATUSES.has(application.status))
    .map((application) => ({
      application,
      action: application.next_action ?? inferAction(application),
      priority: actionPriority(application),
    }))
    .sort((left, right) => right.priority - left.priority);
}

function inferAction(application: ApplicationData) {
  if (application.status === "saved") {
    return "Decide whether to apply based on fit score and gaps.";
  }
  if (application.status === "preparing") {
    return application.interview_prep_id
      ? "Review interview prep and rehearse weak-area drills."
      : "Generate interview prep for this target.";
  }
  if (application.status === "applied") {
    return "Follow up after 7 days if there is no response.";
  }
  if (application.status === "assessment") {
    return "Practice the highest-impact missing skill before the assessment.";
  }
  if (application.status === "interview") {
    return "Rehearse project explanation and behavioral STAR answers.";
  }
  return "Review tracker details.";
}

function actionPriority(application: ApplicationData) {
  if (application.interview_date) {
    return 100;
  }
  if (application.deadline) {
    return 90;
  }
  if (application.status === "assessment" || application.status === "interview") {
    return 80;
  }
  return application.fit_score ?? 0;
}

function EmptyState({ text }: Readonly<{ text: string }>) {
  return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</p>;
}
