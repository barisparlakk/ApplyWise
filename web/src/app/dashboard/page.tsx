import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
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
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="app-kicker">Overview</p>
            <h1 className="app-title">Good to see you, {firstName(user.full_name ?? user.email)}.</h1>
            <p className="app-subtitle">
              Keep the strongest opportunities moving and turn every gap into a concrete next step.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-[#176e60]"
            href="/jobs/new"
          >
            Analyze a new job
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard detail="Saved through interview stages" label="Active applications" value={activeApplications.length.toString()} />
          <StatCard detail="Open applications with dates" label="Upcoming deadlines" value={upcomingDeadlines.length.toString()} />
          <StatCard detail="Across analyzed targets" label="Average fit" value={formatAverageFit(applications)} />
          <StatCard detail="Tracked opportunities" label="Total pipeline" value={applications.length.toString()} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <section className="app-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="text-base font-semibold text-foreground">Priority queue</p>
                <p className="mt-1 text-sm text-muted-foreground">The actions most likely to move your applications forward.</p>
              </div>
              <Link className="text-sm font-semibold text-primary hover:underline" href="/applications">
                Open tracker
              </Link>
            </div>
            <div className="divide-y divide-border">
              {nextBestActions.length ? (
                nextBestActions.slice(0, 4).map((item, index) => (
                  <Link
                    className="group grid gap-3 px-5 py-4 transition hover:bg-[#f5faf8] sm:grid-cols-[34px_1fr_auto] sm:items-center sm:px-6"
                    href={`/applications/${item.application.id}`}
                    key={`${item.application.id}-${item.action}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-[#e6f2ee] text-xs font-bold text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground group-hover:text-primary">{item.action}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.application.company} <span className="text-border">/</span> {item.application.role}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#16675a]">{formatScore(item.application.fit_score)}</span>
                  </Link>
                ))
              ) : (
                <EmptyState text="Your next actions will appear after you save an application." />
              )}
            </div>
          </section>

          <section className="app-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-foreground">Skill leverage</p>
                <p className="mt-1 text-sm text-muted-foreground">Focus on gaps recurring across your target roles.</p>
              </div>
              <Link className="text-sm font-semibold text-primary hover:underline" href="/roadmap">
                Roadmap
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {topMissingSkills.length ? (
                topMissingSkills.slice(0, 5).map((skill, index) => (
                  <div className="grid grid-cols-[26px_1fr_auto] items-center gap-3" key={skill.name}>
                    <span className="text-xs font-semibold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{skill.name}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[#f0a13a]" style={{ width: `${Math.min(100, skill.count * 28)}%` }} />
                      </div>
                    </div>
                    <span className="data-chip">{skill.count} roles</span>
                  </div>
                ))
              ) : (
                <EmptyState text="Missing skills appear after job analyses are saved." />
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="app-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-foreground">Upcoming deadlines</p>
                <p className="mt-1 text-sm text-muted-foreground">Plan before the window closes.</p>
              </div>
              <Link className="text-sm font-semibold text-primary hover:underline" href="/applications">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {upcomingDeadlines.length ? upcomingDeadlines.map((application) => (
                <Link className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 transition hover:border-[#6cb5a3] hover:bg-[#f5faf8]" href={`/applications/${application.id}`} key={application.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{application.company}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{application.role}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#fff1d9] px-2.5 py-1 text-xs font-semibold text-[#9a5d10]">{formatDate(application.deadline)}</span>
                </Link>
              )) : <EmptyState text="No deadlines yet. Add them to applications that need attention." />}
            </div>
          </section>

          <section className="app-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="text-base font-semibold text-foreground">Recent fit analyses</p>
                <p className="mt-1 text-sm text-muted-foreground">A quick read on how your profile maps to each role.</p>
              </div>
              <Link className="text-sm font-semibold text-primary hover:underline" href="/applications">View all</Link>
            </div>
            <div className="divide-y divide-border">
              {recentFitScores.length ? recentFitScores.map((application) => (
                <Link className="grid gap-3 px-5 py-4 transition hover:bg-[#f5faf8] sm:grid-cols-[1fr_170px_auto] sm:items-center sm:px-6" href={`/applications/${application.id}`} key={application.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{application.company}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{application.role}</p>
                  </div>
                  <div className="hidden h-2 overflow-hidden rounded-full bg-muted sm:block">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${application.fit_score ?? 0}%` }} />
                  </div>
                  <span className="text-lg font-semibold text-foreground">{formatScore(application.fit_score)}</span>
                </Link>
              )) : <EmptyState text="Analyze and save a job to see fit scores here." />}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

function StatCard({ detail, label, value }: Readonly<{ detail: string; label: string; value: string }>) {
  return (
    <div className="app-surface p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
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
  return <p className="m-5 rounded-lg border border-dashed border-border bg-[#f8fbfa] p-4 text-sm leading-6 text-muted-foreground">{text}</p>;
}

function firstName(value: string) {
  return value.split(/[\s@]/)[0] || value;
}
