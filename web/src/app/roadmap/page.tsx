import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Crosshair,
  Flame,
  ListChecks,
  Route,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MotionBar, Reveal } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import type { RoadmapData } from "@/lib/api";
import { getRoadmaps } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

type RoadmapPageProps = {
  searchParams: Promise<{ days?: string }>;
};

export default async function RoadmapPage({ searchParams }: RoadmapPageProps) {
  const session = await getBackendSession();
  const params = await searchParams;
  const durationDays = parseRoadmapDays(params.days);

  if (!session) {
    redirect("/login?callbackUrl=/roadmap");
  }

  const roadmaps = await getRoadmaps(session, durationDays);
  const taskCount = roadmaps.reduce((total, roadmap) => total + roadmap.plan.reduce((dayTotal, day) => dayTotal + day.tasks.length, 0), 0);
  const gapCount = roadmaps.reduce((total, roadmap) => total + roadmap.missing_skills.length, 0);
  const topGap = roadmaps.flatMap((roadmap) => roadmap.missing_skills).sort((left, right) => right.impact_score - left.impact_score)[0];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <PageHeader
          action={<DurationLinks selectedDays={durationDays} />}
          description="Convert recurring fit gaps into short, dated work that raises readiness for a specific target."
          eyebrow="Readiness operations"
          icon={Route}
          title="Missing-skills roadmaps"
        />

        <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
          <SignalField className="left-auto w-[50%] opacity-45" compact />
          <div className="relative grid lg:grid-cols-[1fr_440px]">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]"><Flame className="h-3.5 w-3.5" />Highest-leverage gap</div>
              <h2 className="mt-4 text-2xl font-bold">{topGap?.name ?? "Analyze a target role to reveal the next gap"}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/[0.55]">{topGap?.reason ?? "Roadmaps are generated from your computed fit components and role requirements."}</p>
            </div>
            <div className="grid grid-cols-3 border-t border-white/[0.10] lg:border-l lg:border-t-0">
              <RoadmapMetric label="Plans" value={roadmaps.length.toString()} />
              <RoadmapMetric label="Gaps" value={gapCount.toString()} />
              <RoadmapMetric label="Tasks" value={taskCount.toString()} />
            </div>
          </div>
        </Reveal>

        <div className="space-y-6">
          {roadmaps.length ? roadmaps.map((roadmap, index) => (
            <Reveal delay={Math.min(0.04 * index, 0.16)} key={roadmap.id}><RoadmapPanel roadmap={roadmap} /></Reveal>
          )) : <EmptyRoadmap />}
        </div>
      </div>
    </AppShell>
  );
}

function RoadmapPanel({ roadmap }: Readonly<{ roadmap: RoadmapData }>) {
  return (
    <article className="app-surface overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#D9473F]"><Target className="h-3.5 w-3.5" />{roadmap.target_role}</div>
          <h2 className="mt-3 text-xl font-bold text-foreground">{roadmap.title}</h2>
          <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{roadmap.duration_days}-day readiness sprint</p>
        </div>
        {roadmap.job_post_id ? <Link className="motion-control inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-bold text-foreground hover:border-[#FF5A4E] hover:text-[#D9473F]" href={`/jobs/${roadmap.job_post_id}/analysis?days=${roadmap.duration_days}`}>Open fit analysis <ArrowRight className="h-4 w-4" /></Link> : null}
      </header>

      <div className="grid lg:grid-cols-[320px_1fr]">
        <section className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground"><Crosshair className="h-4 w-4 text-[#D9473F]" />Gap priority</div>
          <div className="mt-5 space-y-5">
            {roadmap.missing_skills.map((skill) => (
              <div key={skill.name}>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold text-foreground"><span className="mr-2 text-[#D9473F]">{String(skill.rank).padStart(2, "0")}</span>{skill.name}</p>
                  <span className="text-xs font-bold text-muted-foreground">{Math.round(skill.impact_score)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eceef1]"><MotionBar className={skill.rank === 1 ? "bg-[#FF5A4E]" : "bg-[#F0A13A]"} value={skill.impact_score} /></div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{skill.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground"><ListChecks className="h-4 w-4 text-[#167D87]" />Action schedule</div>
          <div className="relative mt-5 space-y-0 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
            {roadmap.plan.map((day) => (
              <article className="relative grid grid-cols-[32px_1fr] gap-4 pb-7 last:pb-0" key={day.day}>
                <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border-4 border-white bg-[#101318] text-[10px] font-bold text-white">{day.day}</span>
                <div className="min-w-0 pt-1">
                  <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-bold text-foreground">{day.focus}</h3><span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{formatDate(day.date)}</span></div>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground xl:grid-cols-2">{day.tasks.map((task) => <li className="flex items-start gap-2" key={task}><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#167D87]" />{task}</li>)}</ul>
                  <p className="mt-3 border-l-2 border-[#2BC3CE] pl-3 text-sm font-semibold text-foreground">{day.outcome}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function EmptyRoadmap() {
  return (
    <Reveal className="border-y border-dashed border-border bg-white px-6 py-14 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-[#D9473F]" />
      <h2 className="mt-4 text-lg font-bold text-foreground">No roadmap yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Analyze a role to rank missing skills and create a dated readiness sprint.</p>
      <Link className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#101318] px-4 text-sm font-bold text-white hover:bg-[#292d34]" href="/jobs/new">Analyze a role <ArrowRight className="h-4 w-4" /></Link>
    </Reveal>
  );
}

function RoadmapMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="flex flex-col justify-center border-r border-white/[0.10] p-5 last:border-r-0 sm:p-6"><p className="text-3xl font-bold text-white">{value}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/[0.42]">{label}</p></div>;
}

function DurationLinks({ selectedDays }: Readonly<{ selectedDays: number }>) {
  return (
    <div aria-label="Roadmap duration" className="flex rounded-md border border-border bg-[#f7f8f9] p-1">
      {[3, 7, 14].map((days) => <Link className={days === selectedDays ? "rounded-sm bg-[#101318] px-3 py-1.5 text-xs font-bold text-white" : "rounded-sm px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"} href={`/roadmap?days=${days}`} key={days}>{days}d</Link>)}
    </div>
  );
}

function parseRoadmapDays(value: string | undefined) {
  const days = Number(value);
  return days === 7 || days === 14 ? days : 3;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
