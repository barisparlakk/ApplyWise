import Link from "next/link";

import { InterviewPrepAction } from "@/app/jobs/[id]/analysis/interview-prep-action";
import type { JobPostData } from "@/lib/api";

type JobAnalysisViewProps = {
  apiBaseUrl: string;
  backendToken: string;
  jobPost: JobPostData;
  roadmapDays: number;
};

export function JobAnalysisView({
  apiBaseUrl,
  backendToken,
  jobPost,
  roadmapDays,
}: JobAnalysisViewProps) {
  const analysis = jobPost.analysis;
  const fitAnalysis = jobPost.fit_analysis;
  const roadmap = jobPost.roadmap;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="app-surface p-5 sm:p-6">
          <p className="app-kicker">
            Job Analysis
          </p>
          <h1 className="app-title">{jobPost.title}</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Metric label="Company" value={jobPost.company_name} />
            <Metric label="Seniority" value={analysis.seniority_level} />
            <Metric label="Domain" value={analysis.domain} />
            <Metric label="Difficulty" value={analysis.technical_difficulty} />
          </div>
        </div>

        {fitAnalysis ? (
          <div className="app-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="app-kicker">
                  Overall Fit
                </p>
                <h2 className="mt-2 text-5xl font-semibold text-foreground">
                  {formatScore(fitAnalysis.total_score)}
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {fitAnalysis.explanation.recommended_action}
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <ScoreBar label="Skill match" value={fitAnalysis.components.skill_score} />
              <ScoreBar
                label="Project relevance"
                value={fitAnalysis.components.project_relevance_score}
              />
              <ScoreBar label="Experience" value={fitAnalysis.components.experience_score} />
              <ScoreBar label="Education" value={fitAnalysis.components.education_score} />
              <ScoreBar label="Language" value={fitAnalysis.components.language_score} />
              <ScoreBar label="Domain" value={fitAnalysis.components.domain_score} />
              <ScoreBar
                label="Profile quality"
                value={fitAnalysis.components.profile_quality_score}
              />
            </div>
          </div>
        ) : null}

        {fitAnalysis ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <ListPanel items={fitAnalysis.explanation.strong_matches} title="Strong matches" />
            <ListPanel items={fitAnalysis.explanation.weak_areas} title="Weak areas" />
          </div>
        ) : null}

        {roadmap ? (
          <div className="app-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="app-kicker">
                  Missing-Skills Roadmap
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">
                  {roadmap.title}
                </h2>
              </div>
              <DurationLinks jobPostId={jobPost.id} selectedDays={roadmapDays} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                {roadmap.missing_skills.map((skill) => (
                  <div className="rounded-lg border border-border bg-[#fbfdfc] px-3 py-3" key={skill.name}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {skill.rank}. {skill.name}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {Math.round(skill.impact_score)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {skill.reason}
                    </p>
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
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <ListPanel items={analysis.required_skills} title="Required skills" />
          <ListPanel items={analysis.nice_to_have_skills} title="Nice-to-have skills" />
          <ListPanel items={analysis.responsibilities} title="Responsibilities" />
          <ListPanel items={analysis.hidden_expectations} title="Hidden expectations" />
          <ListPanel items={analysis.business_expectations} title="Business expectations" />
          <ListPanel
            items={analysis.communication_expectations}
            title="Communication expectations"
          />
        </div>
      </section>

      <aside className="space-y-6">
        <div className="app-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Signals</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryItem label="English" value={analysis.english_requirement} />
            <SummaryItem label="Source" value={jobPost.source ?? "manual"} />
            <SummaryItem label="Location" value={jobPost.location ?? "Not specified"} />
          </dl>
          <div className="mt-5">
            <InterviewPrepAction
              apiBaseUrl={apiBaseUrl}
              backendToken={backendToken}
              jobPostId={jobPost.id}
            />
          </div>
        </div>

        <div className="app-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Raw post</h2>
          <pre
            className={
              "mt-4 max-h-[640px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground"
            }
          >
            {jobPost.description}
          </pre>
        </div>
      </aside>
    </div>
  );
}

function DurationLinks({
  jobPostId,
  selectedDays,
}: Readonly<{ jobPostId: string; selectedDays: number }>) {
  return (
    <div className="flex rounded-md border border-border p-1">
      {[3, 7, 14].map((days) => (
        <Link
          className={
            days === selectedDays
              ? "rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              : "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground"
          }
          href={`/jobs/${jobPostId}/analysis?days=${days}`}
          key={days}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}

function ListPanel({ items, title }: Readonly<{ items: string[]; title: string }>) {
  return (
    <div className="app-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>Not specified</li>}
      </ul>
    </div>
  );
}

function ScoreBar({ label, value }: Readonly<{ label: string; value: number }>) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="rounded-lg border border-border bg-[#fbfdfc] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{formatScore(value)}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-sm bg-secondary">
        <div className="h-full bg-primary" style={{ width: `${normalizedValue}%` }} />
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatScore(value: number) {
  return `${Math.round(value)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
