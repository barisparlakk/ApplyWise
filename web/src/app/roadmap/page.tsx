import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import type { RoadmapData } from "@/lib/api";
import { getRoadmaps } from "@/lib/api";
import { authOptions } from "@/lib/auth";

type RoadmapPageProps = {
  searchParams?: {
    days?: string;
  };
};

export default async function RoadmapPage({ searchParams }: RoadmapPageProps) {
  const session = await getServerSession(authOptions);
  const durationDays = parseRoadmapDays(searchParams?.days);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/roadmap");
  }

  const roadmaps = await getRoadmaps(session, durationDays);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Roadmap
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              Missing-skills prep plans
            </h1>
          </div>
          <DurationLinks selectedDays={durationDays} />
        </div>

        <div className="mt-6 space-y-6">
          {roadmaps.length ? (
            roadmaps.map((roadmap) => <RoadmapPanel key={roadmap.id} roadmap={roadmap} />)
          ) : (
            <div className="rounded-md border border-border bg-white p-5">
              <p className="text-sm text-muted-foreground">
                Analyze a job first to generate a ranked missing-skills roadmap.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function RoadmapPanel({ roadmap }: Readonly<{ roadmap: RoadmapData }>) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{roadmap.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{roadmap.target_role}</p>
        </div>
        {roadmap.job_post_id ? (
          <Link
            className="h-9 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground"
            href={`/jobs/${roadmap.job_post_id}/analysis?days=${roadmap.duration_days}`}
          >
            Open analysis
          </Link>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          {roadmap.missing_skills.map((skill) => (
            <div className="rounded-md border border-border px-3 py-3" key={skill.name}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {skill.rank}. {skill.name}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {Math.round(skill.impact_score)}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{skill.reason}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {roadmap.plan.map((day) => (
            <div className="rounded-md border border-border px-4 py-3" key={day.day}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Day {day.day}: {day.focus}
                </h3>
                <p className="text-xs text-muted-foreground">{formatDate(day.date)}</p>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                {day.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-medium text-foreground">{day.outcome}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DurationLinks({ selectedDays }: Readonly<{ selectedDays: number }>) {
  return (
    <div className="flex rounded-md border border-border bg-white p-1">
      {[3, 7, 14].map((days) => (
        <Link
          className={
            days === selectedDays
              ? "rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              : "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground"
          }
          href={`/roadmap?days=${days}`}
          key={days}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}

function parseRoadmapDays(value: string | undefined) {
  const days = Number(value);
  return days === 7 || days === 14 ? days : 3;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
