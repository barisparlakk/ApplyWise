import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  CircleDot,
  Clock3,
  Crosshair,
  Flame,
  Radar,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MotionBar, Reveal } from "@/components/motion";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { ScoreRing } from "@/components/score-ring";
import { SignalField } from "@/components/signal-field";
import type { ApplicationData } from "@/lib/api";
import { getApplications, getCurrentUser } from "@/lib/api";
import { createTranslator, localeTag, type Translator } from "@/lib/i18n";
import { getBackendSession } from "@/lib/server-auth";
import { getRequestLocale } from "@/lib/server-i18n";

const ACTIVE_STATUSES = new Set(["saved", "preparing", "applied", "assessment", "interview"]);
const CLOSED_STATUSES = new Set(["rejected", "offer", "archived"]);

const STATUS_ORDER = ["saved", "preparing", "applied", "assessment", "interview"] as const;

export default async function DashboardPage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const user = await getCurrentUser(session);
  const applications = await getApplications(session);
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
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
  const nextBestActions = buildNextBestActions(applications, t).slice(0, 5);
  const averageFit = averageFitValue(applications);
  const leadAction = nextBestActions[0];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1400px]">
        <PageHeader
          action={(
            <Link className="motion-control inline-flex h-10 items-center gap-2 rounded-md bg-[#101318] px-4 text-sm font-bold text-white hover:bg-[#292d34] min-[960px]:hidden" href="/jobs/new">
              <Radar className="h-4 w-4 text-[#FF6B60]" />
              {t("Analyze a role")}
            </Link>
          )}
          description={t("See what needs attention now, where your evidence is strongest, and which move creates the most leverage.")}
          eyebrow={t("Career command center")}
          icon={Crosshair}
          title={t("Good to see you, {name}.", { name: firstName(user.full_name ?? user.email) })}
        />

        <Reveal className="relative mt-6 overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_22px_50px_rgba(16,19,24,0.16)]">
          <SignalField className="left-auto w-[58%] opacity-65" compact />
          <div className="relative grid min-h-[260px] lg:grid-cols-[1.3fr_0.7fr]">
            <div className="flex flex-col justify-between border-b border-white/[0.10] p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("Highest-leverage move")}
                </div>
                {leadAction ? (
                  <>
                    <h2 className="mt-4 max-w-2xl text-2xl font-bold leading-tight sm:text-[1.75rem]">
                      {leadAction.action}
                    </h2>
                    <p className="mt-3 text-sm text-white/[0.55]">
                      {leadAction.application.company} / {leadAction.application.role}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="mt-4 max-w-xl text-2xl font-bold leading-tight sm:text-[1.75rem]">
                      {t("Analyze your first target role to activate your decision queue.")}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/[0.55]">
                      {t("ApplyWise will compare the role against your CV, projects, skills, and profile evidence.")}
                    </p>
                  </>
                )}
              </div>
              <Link className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-bold text-white hover:text-[#FF786D]" href={leadAction ? `/applications/${leadAction.application.id}` : "/jobs/new"}>
                {leadAction ? t("Open action") : t("Start role analysis")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative flex items-center justify-center gap-8 p-6 sm:p-8">
              <ScoreRing className="w-36" label={t("Avg. fit")} value={averageFit} />
              <div className="space-y-4">
                <SignalMetric label={t("Active")} value={activeApplications.length.toString()} />
                <SignalMetric label={t("Deadlines")} value={upcomingDeadlines.length.toString()} />
                <SignalMetric label={t("Targets")} value={applications.length.toString()} />
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.75fr] xl:items-start">
          <Reveal className="app-surface overflow-hidden" delay={0.05}>
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <SectionHeading
                action={<InlineLink href="/applications" label={t("Open pipeline")} />}
                description={t("Ordered by urgency, stage, deadline, and current fit.")}
                title={t("Decision queue")}
              />
            </div>
            <div className="divide-y divide-border">
              {nextBestActions.length ? (
                nextBestActions.slice(0, 5).map((item, index) => (
                  <Link
                    className="group grid gap-3 px-5 py-4 transition hover:bg-[#f7f8f9] sm:grid-cols-[38px_1fr_120px_50px] sm:items-center sm:px-6"
                    href={`/applications/${item.application.id}`}
                    key={`${item.application.id}-${item.action}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-border bg-[#f7f8f9] text-xs font-bold text-muted-foreground group-hover:border-[#f0b5b0] group-hover:text-[#D9473F]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground group-hover:text-[#D9473F]">{item.action}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {item.application.company} / {item.application.role}
                      </p>
                    </div>
                    <StatusChip status={t(item.application.status)} />
                    <span className="text-right text-sm font-bold text-foreground">{formatScore(item.application.fit_score)}</span>
                  </Link>
                ))
              ) : (
                <EmptyState icon={Target} text={t("Save a role analysis to build your first decision queue.")} />
              )}
            </div>
          </Reveal>

          <Reveal className="app-surface p-5 sm:p-6" delay={0.1}>
            <SectionHeading
              action={<InlineLink href="/applications" label={t("View all")} />}
              description={t("Current movement across active stages.")}
              title={t("Pipeline signal")}
            />
            <div className="mt-6 space-y-4">
              {STATUS_ORDER.map((status) => {
                const count = activeApplications.filter((application) => application.status === status).length;
                const width = activeApplications.length ? (count / activeApplications.length) * 100 : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold capitalize text-[#4d545e]">{t(status)}</span>
                      <span className="font-bold text-foreground">{count}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eceef1]">
                      <MotionBar className={status === "interview" ? "bg-[#2BC3CE]" : "bg-[#101318]"} value={width} />
                    </div>
                  </div>
                );
              })}
            </div>
            {!activeApplications.length ? <p className="mt-5 text-sm leading-6 text-muted-foreground">{t("Your active stages will appear here once an application is saved.")}</p> : null}
          </Reveal>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Reveal className="app-surface p-5 sm:p-6" delay={0.08}>
            <SectionHeading
              action={<InlineLink href="/roadmap" label={t("Open roadmap")} />}
              description={t("Recurring gaps across the roles you care about.")}
              title={t("Skill leverage")}
            />
            <div className="mt-5 space-y-4">
              {topMissingSkills.length ? (
                topMissingSkills.slice(0, 5).map((skill, index) => (
                  <div className="grid grid-cols-[28px_1fr_auto] items-center gap-3" key={skill.name}>
                    <span className="text-xs font-bold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{skill.name}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eceef1]">
                        <MotionBar className={index === 0 ? "bg-[#FF5A4E]" : "bg-[#F0A13A]"} value={Math.min(100, skill.count * 28)} />
                      </div>
                    </div>
                    <span className="data-chip">{t("{count} roles", { count: skill.count })}</span>
                  </div>
                ))
              ) : (
                <EmptyState icon={Flame} text={t("Analyze more roles to reveal recurring skill gaps.")} />
              )}
            </div>
          </Reveal>

          <Reveal className="app-surface overflow-hidden" delay={0.13}>
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <SectionHeading
                action={<InlineLink href="/applications" label={t("Open pipeline")} />}
                description={t("Comparable evidence strength across your latest targets.")}
                title={t("Recent fit matrix")}
              />
            </div>
            <div className="divide-y divide-border">
              {recentFitScores.length ? recentFitScores.map((application) => (
                <Link className="grid gap-3 px-5 py-4 transition hover:bg-[#f7f8f9] sm:grid-cols-[1fr_190px_54px] sm:items-center sm:px-6" href={`/applications/${application.id}`} key={application.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{application.company}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{application.role}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#eceef1]">
                    <MotionBar className={scoreBarColor(application.fit_score)} value={application.fit_score ?? 0} />
                  </div>
                  <span className="text-right text-base font-bold text-foreground">{formatScore(application.fit_score)}</span>
                </Link>
              )) : <EmptyState icon={ChartNoAxesColumnIncreasing} text={t("Your scored targets will appear here after a job analysis.")} />}
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-6 border-y border-border bg-white" delay={0.16}>
          <div className="grid lg:grid-cols-[240px_1fr]">
            <div className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]">
                <CalendarClock className="h-4 w-4" />
                {t("Time-sensitive")}
              </div>
              <h2 className="mt-3 text-xl font-bold text-foreground">{t("Upcoming deadlines")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("Keep preparation ahead of the closing window.")}</p>
            </div>
            <div className="divide-y divide-border">
              {upcomingDeadlines.length ? upcomingDeadlines.map((application) => (
                <Link className="group grid gap-2 px-5 py-4 transition hover:bg-[#fff8f7] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6" href={`/applications/${application.id}`} key={application.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground group-hover:text-[#D9473F]">{application.company} / {application.role}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{t(application.status)}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[#A63832]">
                    <Clock3 className="h-4 w-4" />
                    {formatDate(application.deadline, localeTag(locale))}
                  </span>
                </Link>
              )) : <EmptyState icon={CalendarClock} text={t("No upcoming deadlines. Add dates to active applications to prioritize them here.")} />}
            </div>
          </div>
        </Reveal>
      </div>
    </AppShell>
  );
}

function SignalMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border-l border-white/[0.15] pl-4">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase text-white/[0.45]">{label}</p>
    </div>
  );
}

function InlineLink({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <Link className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#D9473F] hover:text-foreground" href={href}>
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function StatusChip({ status }: Readonly<{ status: string }>) {
  return (
    <span className="hidden w-fit items-center gap-1.5 rounded-md border border-border bg-[#f7f8f9] px-2.5 py-1 text-[10px] font-bold uppercase text-[#4d545e] sm:inline-flex">
      <CircleDot className="h-3 w-3 text-[#2BC3CE]" />
      {status}
    </span>
  );
}

function averageFitValue(applications: ApplicationData[]) {
  const scores = applications
    .map((application) => application.fit_score)
    .filter((score): score is number => score !== null);
  if (!scores.length) return null;
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function formatScore(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function scoreBarColor(value: number | null) {
  if (value === null || value < 55) return "bg-[#FF5A4E]";
  if (value < 75) return "bg-[#F0A13A]";
  return "bg-[#2BC3CE]";
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "--";
  return new Intl.DateTimeFormat(locale, {
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

function buildNextBestActions(applications: ApplicationData[], t: Translator) {
  return applications
    .filter((application) => !CLOSED_STATUSES.has(application.status))
    .map((application) => ({
      application,
      action: application.next_action ? t(application.next_action) : t(inferAction(application)),
      priority: actionPriority(application),
    }))
    .sort((left, right) => right.priority - left.priority);
}

function inferAction(application: ApplicationData) {
  if (application.status === "saved") return "Decide whether to apply based on fit score and gaps.";
  if (application.status === "preparing") {
    return application.interview_prep_id
      ? "Review interview prep and rehearse weak-area drills."
      : "Generate interview prep for this target.";
  }
  if (application.status === "applied") return "Follow up after 7 days if there is no response.";
  if (application.status === "assessment") return "Practice the highest-impact missing skill before the assessment.";
  if (application.status === "interview") return "Rehearse project explanation and behavioral STAR answers.";
  return "Review tracker details.";
}

function actionPriority(application: ApplicationData) {
  if (application.interview_date) return 100;
  if (application.deadline) return 90;
  if (application.status === "assessment" || application.status === "interview") return 80;
  return application.fit_score ?? 0;
}

function EmptyState({ icon: Icon, text }: Readonly<{ icon: typeof BriefcaseBusiness; text: string }>) {
  return (
    <div className="m-5 flex items-start gap-3 rounded-lg border border-dashed border-border bg-[#f8f9fa] p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#D9473F]" />
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function firstName(value: string) {
  return value.split(/[\s@]/)[0] || value;
}
