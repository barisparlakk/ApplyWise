import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CircleCheck,
  CircleX,
  Clock3,
  Code2,
  ExternalLink,
  Eye,
  Gauge,
  Globe2,
  GraduationCap,
  Languages,
  ListChecks,
  MessageCircleMore,
  Radar,
  Route,
  ScanText,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { InterviewPrepAction } from "@/app/jobs/[id]/analysis/interview-prep-action";
import { MotionBar, Reveal } from "@/components/motion";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { ScoreRing } from "@/components/score-ring";
import { SignalField } from "@/components/signal-field";
import type { JobPostData } from "@/lib/api";

type JobAnalysisViewProps = {
  apiBaseUrl: string;
  jobPost: JobPostData;
  roadmapDays: number;
};

const SCORE_COMPONENTS = [
  { key: "skill_score", label: "Skill match", weight: 30, icon: Wrench },
  { key: "project_relevance_score", label: "Project relevance", weight: 20, icon: Code2 },
  { key: "experience_score", label: "Experience", weight: 15, icon: BriefcaseBusiness },
  { key: "education_score", label: "Education", weight: 10, icon: GraduationCap },
  { key: "language_score", label: "Language", weight: 10, icon: Languages },
  { key: "domain_score", label: "Domain", weight: 10, icon: Target },
  { key: "profile_quality_score", label: "Profile quality", weight: 5, icon: Sparkles },
] as const;

export function JobAnalysisView({ apiBaseUrl, jobPost, roadmapDays }: JobAnalysisViewProps) {
  const analysis = jobPost.analysis;
  const fitAnalysis = jobPost.fit_analysis;
  const roadmap = jobPost.roadmap;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={jobPost.url ? (
          <a className="motion-control inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3.5 text-xs font-bold text-foreground hover:border-[#FF5A4E] hover:text-[#D9473F]" href={jobPost.url} rel="noreferrer" target="_blank">
            View source <ExternalLink className="h-4 w-4" />
          </a>
        ) : undefined}
        description={`${analysis.seniority_level} role in ${analysis.domain}. The score below is computed from your current profile evidence.`}
        eyebrow={jobPost.company_name}
        icon={Radar}
        title={jobPost.title}
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_22px_50px_rgba(16,19,24,0.16)]">
        <SignalField className="left-auto w-[54%] opacity-50" compact />
        <div className="relative grid lg:grid-cols-[1fr_390px]">
          <div className="flex min-h-[275px] flex-col justify-between border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]"><TrendingUp className="h-3.5 w-3.5" />Recommended decision</div>
              <h2 className="mt-4 max-w-3xl text-2xl font-bold leading-tight sm:text-[1.75rem]">
                {fitAnalysis?.explanation.recommended_action ?? "Fit analysis is not available for this role yet."}
              </h2>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/55">
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#2BC3CE]" />{jobPost.company_name}</span>
              <span className="flex items-center gap-2"><Target className="h-4 w-4 text-[#2BC3CE]" />{analysis.domain}</span>
              <span className="flex items-center gap-2"><Gauge className="h-4 w-4 text-[#2BC3CE]" />{analysis.technical_difficulty}</span>
            </div>
          </div>
          <div className="relative flex items-center justify-center gap-7 p-6 sm:p-8">
            <ScoreRing className="w-40" label="Overall fit" value={fitAnalysis?.total_score ?? null} />
            <div className="hidden space-y-4 sm:block">
              <HeroSignal label="Method" value="Hybrid" />
              <HeroSignal label="Components" value="7" />
              <HeroSignal label="Override" value="None" />
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-6">
          {fitAnalysis ? (
            <Reveal className="app-surface overflow-hidden" delay={0.04}>
              <div className="border-b border-border p-5 sm:p-6">
                <SectionHeading description="Each component is calculated independently, then combined using the fixed ApplyWise weighting formula." title="Deterministic fit breakdown" />
              </div>
              <div className="grid md:grid-cols-2">
                {SCORE_COMPONENTS.map((component) => (
                  <ScoreBar
                    icon={component.icon}
                    key={component.key}
                    label={component.label}
                    value={fitAnalysis.components[component.key]}
                    weight={component.weight}
                  />
                ))}
                <div className="flex items-center gap-3 bg-[#f8f9fa] p-5 sm:p-6">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#101318] text-white"><Gauge className="h-4 w-4" /></div>
                  <div><p className="text-xs font-bold uppercase text-muted-foreground">Weighted result</p><p className="mt-1 text-2xl font-bold text-foreground">{formatScore(fitAnalysis.total_score)}</p></div>
                </div>
              </div>
            </Reveal>
          ) : null}

          {fitAnalysis ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Reveal className="border-l-2 border-[#2BC3CE] bg-[#effbfc] p-5 sm:p-6" delay={0.08}>
                <InsightList icon={CircleCheck} items={fitAnalysis.explanation.strong_matches} title="Strong matches" tone="positive" />
              </Reveal>
              <Reveal className="border-l-2 border-[#FF5A4E] bg-[#fff5f4] p-5 sm:p-6" delay={0.11}>
                <InsightList icon={CircleX} items={fitAnalysis.explanation.weak_areas} title="Weak areas" tone="negative" />
              </Reveal>
            </div>
          ) : null}

          {roadmap ? (
            <Reveal className="app-surface overflow-hidden" delay={0.12}>
              <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><Route className="h-4 w-4" />Readiness roadmap</div>
                  <h2 className="mt-3 text-xl font-bold text-foreground">{roadmap.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Highest-impact gaps converted into dated preparation work.</p>
                </div>
                <DurationLinks jobPostId={jobPost.id} selectedDays={roadmapDays} />
              </div>

              <div className="grid lg:grid-cols-[300px_1fr]">
                <section className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground">Gap priority</h3>
                  <div className="mt-4 space-y-5">
                    {roadmap.missing_skills.map((skill) => (
                      <div key={skill.name}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-foreground"><span className="mr-2 text-[#D9473F]">{String(skill.rank).padStart(2, "0")}</span>{skill.name}</p>
                          <span className="text-xs font-bold text-muted-foreground">{Math.round(skill.impact_score)}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eceef1]"><MotionBar className="bg-[#FF5A4E]" value={skill.impact_score} /></div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{skill.reason}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="p-5 sm:p-6">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground">Dated plan</h3>
                  <div className="relative mt-5 space-y-0 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
                    {roadmap.plan.map((day) => (
                      <article className="relative grid grid-cols-[32px_1fr] gap-4 pb-6 last:pb-0" key={day.day}>
                        <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border-4 border-white bg-[#101318] text-[10px] font-bold text-white">{day.day}</span>
                        <div className="min-w-0 pt-1">
                          <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-sm font-bold text-foreground">{day.focus}</h4><span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{formatDate(day.date)}</span></div>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{day.tasks.map((task) => <li className="flex items-start gap-2" key={task}><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#167D87]" />{task}</li>)}</ul>
                          <p className="mt-3 border-l-2 border-[#2BC3CE] pl-3 text-sm font-semibold text-foreground">{day.outcome}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </Reveal>
          ) : null}

          <Reveal className="app-surface overflow-hidden" delay={0.14}>
            <div className="border-b border-border p-5 sm:p-6">
              <SectionHeading description="Structured signals extracted from the original listing." title="Role specification" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3">
              <AnalysisGroup icon={Wrench} items={analysis.required_skills} title="Required skills" />
              <AnalysisGroup icon={Sparkles} items={analysis.nice_to_have_skills} title="Nice to have" />
              <AnalysisGroup icon={ListChecks} items={analysis.responsibilities} title="Responsibilities" />
              <AnalysisGroup icon={Eye} items={analysis.hidden_expectations} title="Hidden expectations" />
              <AnalysisGroup icon={BriefcaseBusiness} items={analysis.business_expectations} title="Business expectations" />
              <AnalysisGroup icon={MessageCircleMore} items={analysis.communication_expectations} title="Communication" />
            </div>
          </Reveal>
        </main>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Reveal className="app-surface overflow-hidden" delay={0.06}>
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><ArrowUpRight className="h-4 w-4" />Move this role forward</div>
            </div>
            <div className="p-5">
              <p className="text-sm leading-6 text-muted-foreground">Save this opportunity to the pipeline or start role-specific preparation now.</p>
              <div className="mt-5"><InterviewPrepAction apiBaseUrl={apiBaseUrl} jobPostId={jobPost.id} /></div>
            </div>
          </Reveal>

          <Reveal className="overflow-hidden rounded-lg border border-[#272c33] bg-[#101318] text-white" delay={0.1}>
            <div className="border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#2BC3CE]"><ScanText className="h-4 w-4" />Role signals</div></div>
            <dl className="divide-y divide-white/10 text-sm">
              <SummaryItem icon={Languages} label="English" value={analysis.english_requirement} />
              <SummaryItem icon={Globe2} label="Source" value={jobPost.source ?? "manual"} />
              <SummaryItem icon={Target} label="Location" value={jobPost.location ?? "Not specified"} />
              <SummaryItem icon={Clock3} label="Seniority" value={analysis.seniority_level} />
            </dl>
          </Reveal>

          <Reveal delay={0.14}>
            <details className="app-surface group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-foreground">
                Original job post
                <BookOpenCheck className="h-4 w-4 text-[#D9473F]" />
              </summary>
              <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap border-t border-border bg-[#f8f9fa] p-5 text-xs leading-5 text-muted-foreground">{jobPost.description}</pre>
            </details>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

function HeroSignal({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="border-l border-white/15 pl-4"><p className="text-base font-bold text-white">{value}</p><p className="mt-0.5 text-[10px] font-bold uppercase text-white/42">{label}</p></div>;
}

function DurationLinks({ jobPostId, selectedDays }: Readonly<{ jobPostId: string; selectedDays: number }>) {
  return (
    <div aria-label="Roadmap duration" className="flex rounded-md border border-border bg-[#f7f8f9] p-1">
      {[3, 7, 14].map((days) => (
        <Link className={days === selectedDays ? "rounded-sm bg-[#101318] px-3 py-1.5 text-xs font-bold text-white" : "rounded-sm px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"} href={`/jobs/${jobPostId}/analysis?days=${days}`} key={days}>{days}d</Link>
      ))}
    </div>
  );
}

function InsightList({ icon: Icon, items, title, tone }: Readonly<{ icon: LucideIcon; items: string[]; title: string; tone: "positive" | "negative" }>) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase text-foreground"><Icon className={tone === "positive" ? "h-4 w-4 text-[#167D87]" : "h-4 w-4 text-[#D9473F]"} />{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm leading-6 text-muted-foreground">{items.length ? items.map((item) => <li className="flex items-start gap-2" key={item}><span className={tone === "positive" ? "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2BC3CE]" : "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF5A4E]"} />{item}</li>) : <li>No signals available.</li>}</ul>
    </div>
  );
}

function ScoreBar({ icon: Icon, label, value, weight }: Readonly<{ icon: LucideIcon; label: string; value: number; weight: number }>) {
  const normalizedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="border-b border-border p-5 even:border-l sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#D9473F]" /><div><p className="text-sm font-bold text-foreground">{label}</p><p className="mt-0.5 text-[10px] font-bold uppercase text-muted-foreground">{weight}% weight</p></div></div>
        <p className="text-base font-bold text-foreground">{formatScore(value)}</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eceef1]"><MotionBar className={scoreColor(value)} value={normalizedValue} /></div>
    </div>
  );
}

function AnalysisGroup({ icon: Icon, items, title }: Readonly<{ icon: LucideIcon; items: string[]; title: string }>) {
  return (
    <section className="border-b border-border p-5 md:border-r sm:p-6 [&:nth-child(2n)]:md:border-r-0 [&:nth-child(3n)]:lg:border-r-0 [&:nth-child(2n)]:lg:border-r">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-foreground"><Icon className="h-4 w-4 text-[#D9473F]" />{title}</h3>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">{items.length ? items.map((item) => <li className="flex items-start gap-2" key={item}><ArrowRight className="mt-1.5 h-3 w-3 shrink-0 text-[#2BC3CE]" />{item}</li>) : <li>Not specified</li>}</ul>
    </section>
  );
}

function SummaryItem({ icon: Icon, label, value }: Readonly<{ icon: LucideIcon; label: string; value: string }>) {
  return (
    <div className="grid grid-cols-[22px_78px_1fr] items-center gap-2 px-5 py-3.5">
      <Icon className="h-4 w-4 text-[#2BC3CE]" />
      <dt className="text-white/42">{label}</dt>
      <dd className="text-right font-bold text-white">{value}</dd>
    </div>
  );
}

function scoreColor(value: number) {
  if (value >= 75) return "bg-[#2BC3CE]";
  if (value >= 55) return "bg-[#F0A13A]";
  return "bg-[#FF5A4E]";
}

function formatScore(value: number) {
  return `${Math.round(value)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
