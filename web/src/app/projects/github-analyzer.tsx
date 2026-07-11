"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Check,
  CircleCheck,
  CircleX,
  Code2,
  Container,
  ExternalLink,
  FileText,
  GitBranch,
  GitFork,
  Radio,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Star,
  TestTube2,
  Workflow,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { z } from "zod";

import { MotionBar, Reveal } from "@/components/motion";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GitHubRepositoryData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";

const analyzeSchema = z.object({
  repo_url: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) =>
        /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(value) ||
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) ||
        /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(value),
      "Enter a GitHub repository URL.",
    ),
});

type AnalyzeState = "idle" | "analyzing" | "ready" | "error";

type GitHubAnalyzerProps = {
  apiBaseUrl: string;
  initialRepositories: GitHubRepositoryData[];
};

export function GitHubAnalyzer({
  apiBaseUrl,
  initialRepositories,
}: GitHubAnalyzerProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [repositories, setRepositories] = useState(initialRepositories);
  const [state, setState] = useState<AnalyzeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  async function analyzeRepository() {
    const parsed = analyzeSchema.safeParse({ repo_url: repoUrl });
    if (!parsed.success) {
      setState("error");
      setErrorMessage("Enter a GitHub repository URL.");
      return;
    }

    try {
      setState("analyzing");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/github/repositories/analyze`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw await apiError(response, "Analysis failed");
      }

      const repository = (await response.json()) as GitHubRepositoryData;
      setRepositories((current) => [
        repository,
        ...current.filter((item) => item.id !== repository.id),
      ]);
      setRepoUrl("");
      setState("ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed.");
      setState("error");
    }
  }

  const statusText = {
    idle: "Ready",
    analyzing: "Analyzing",
    ready: "Saved",
    error: "Needs attention",
  }[state];
  const withTests = repositories.filter((repo) => repo.deterministic_signals.has_tests).length;
  const withCi = repositories.filter((repo) => repo.deterministic_signals.has_ci).length;
  const withDocker = repositories.filter((repo) => repo.deterministic_signals.has_docker).length;
  const deliveryCoverage = repositories.length
    ? Math.round(((withTests + withCi + withDocker) / (repositories.length * 3)) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={<AnalyzerStatus state={state} text={statusText} />}
        description="Expose the engineering signals behind each project, then map that evidence to roles where it matters."
        eyebrow="Project evidence"
        icon={GitBranch}
        title="Repository intelligence"
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[50%] opacity-45" compact />
        <div className="relative grid lg:grid-cols-[1fr_420px]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]"><Radio className="h-3.5 w-3.5" />Engineering signal coverage</div>
            <h2 className="mt-4 text-2xl font-bold">{repositories.length ? `${repositories.length} repositories analyzed` : "No project evidence indexed yet"}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">Tests, CI, Docker, documentation, architecture, and activity are checked before qualitative analysis is generated.</p>
          </div>
          <div className="border-t border-white/10 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase text-white/45">Delivery coverage</p><p className="mt-2 text-4xl font-bold">{deliveryCoverage}%</p></div>
              <p className="text-xs font-semibold text-white/48">Tests + CI + Docker</p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><MotionBar className={deliveryCoverage >= 70 ? "bg-[#2BC3CE]" : "bg-[#FF5A4E]"} value={deliveryCoverage} /></div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-6">
          <Reveal className="app-surface p-5 sm:p-6" delay={0.04}>
            <SectionHeading action={<span className="data-chip"><GitFork className="mr-1.5 h-3.5 w-3.5" />Public GitHub</span>} description="Paste a URL, owner/repository reference, or SSH remote." title="Analyze repository" />
            <div className="relative mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              {state === "analyzing" && !reduceMotion ? <motion.span animate={{ x: [0, 260, 0] }} className="absolute -top-1 left-0 h-0.5 w-24 bg-[#FF5A4E]" transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }} /> : null}
              <div>
                <Label htmlFor="repo-url">Repository source</Label>
                <div className="relative mt-2"><GitFork className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" id="repo-url" onChange={(event) => setRepoUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void analyzeRepository(); } }} placeholder="https://github.com/owner/repo" value={repoUrl} /></div>
              </div>
              <Button className="self-end" disabled={state === "analyzing"} onClick={() => void analyzeRepository()} type="button">
                {state === "analyzing" ? <ScanSearch className="h-4 w-4 animate-pulse" /> : <Sparkles className="h-4 w-4" />}
                {state === "analyzing" ? "Auditing repository" : "Analyze repository"}
              </Button>
            </div>
            <AnimatePresence initial={false}>{errorMessage ? <motion.div animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-start gap-2 rounded-md border border-[#f0b5b0] bg-[#fff3f2] p-3 text-sm font-semibold text-[#A63832]" exit={{ opacity: 0, y: -4 }} initial={{ opacity: 0, y: -4 }} role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{errorMessage}</motion.div> : null}</AnimatePresence>
          </Reveal>

          <div className="space-y-6">
            {repositories.length ? repositories.map((repository, index) => (
              <Reveal delay={Math.min(index * 0.04, 0.16)} key={repository.id}><RepositoryCard repository={repository} /></Reveal>
            )) : (
              <Reveal className="border-y border-dashed border-border bg-white px-6 py-12 text-center" delay={0.08}>
                <GitFork className="mx-auto h-8 w-8 text-[#D9473F]" />
                <h2 className="mt-4 text-base font-bold text-foreground">Add your first repository</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Choose work that demonstrates how you solve, test, document, and ship a real problem.</p>
              </Reveal>
            )}
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Reveal className="overflow-hidden rounded-lg border border-[#272c33] bg-[#101318] text-white" delay={0.06}>
            <div className="border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#2BC3CE]"><ShieldCheck className="h-4 w-4" />Portfolio coverage</div></div>
            <dl className="grid grid-cols-2">
              <CoverageSignal icon={GitFork} label="Repositories" value={repositories.length} />
              <CoverageSignal icon={TestTube2} label="With tests" value={withTests} />
              <CoverageSignal icon={Workflow} label="With CI" value={withCi} />
              <CoverageSignal icon={Container} label="With Docker" value={withDocker} />
            </dl>
          </Reveal>

          <Reveal className="app-surface p-5" delay={0.1}>
            <p className="text-xs font-bold uppercase text-[#D9473F]">What gets checked</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {["README and documentation quality", "Testing and delivery automation", "Architecture and complexity signals", "Commit activity and role relevance"].map((item) => <li className="flex items-start gap-2" key={item}><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2BC3CE]" />{item}</li>)}
            </ul>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

function RepositoryCard({ repository }: Readonly<{ repository: GitHubRepositoryData }>) {
  const analysis = repository.analysis;
  const signals = repository.deterministic_signals;

  return (
    <article className="app-surface app-surface-hover overflow-hidden">
      <header className="grid gap-5 border-b border-border p-5 sm:p-6 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground"><GitFork className="h-3.5 w-3.5 text-[#D9473F]" />Repository audit</div>
          <a className="mt-3 inline-flex max-w-full items-center gap-2 text-xl font-bold text-foreground hover:text-[#D9473F]" href={repository.html_url} rel="noreferrer" target="_blank"><span className="truncate">{repository.full_name}</span><ExternalLink className="h-4 w-4 shrink-0" /></a>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{repository.description ?? "No repository description provided."}</p>
          <div className="mt-4 flex flex-wrap gap-2">{analysis.tech_stack.map((item) => <span className="data-chip" key={item}><Code2 className="mr-1.5 h-3 w-3 text-[#167D87]" />{item}</span>)}</div>
        </div>
        <div className="grid grid-cols-2 border border-border text-sm sm:min-w-[300px]">
          <Metric icon={Star} label="Stars" value={repository.stars.toString()} />
          <Metric icon={FileText} label="README" value={analysis.readme_quality} />
          <Metric icon={Boxes} label="Complexity" value={analysis.complexity} />
          <Metric icon={Activity} label="Activity" value={analysis.commit_activity} />
        </div>
      </header>

      <div className="border-b border-border bg-[#f8f9fa] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">Deterministic delivery signals</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <AuditSignal active={signals.has_tests} icon={TestTube2} label="Tests" />
          <AuditSignal active={signals.has_ci} icon={Workflow} label="CI" />
          <AuditSignal active={signals.has_docker} icon={Container} label="Docker" />
          <AuditSignal active={signals.has_docs} icon={FileText} label="Docs" />
          <AuditSignal active={signals.has_deployment_config} icon={ArrowUpRight} label="Deploy" />
          <AuditSignal active={signals.readme_length >= 300} icon={ShieldCheck} label="README" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3">
        <ListPanel icon={CircleCheck} items={analysis.strengths} title="Strengths" tone="positive" />
        <ListPanel icon={CircleX} items={analysis.weaknesses} title="Weaknesses" tone="negative" />
        <ListPanel icon={Sparkles} items={analysis.best_fit_roles} title="Best-fit roles" tone="accent" />
      </div>

      <div className="grid border-t border-border sm:grid-cols-2">
        <ListPanel icon={ScanSearch} items={analysis.recommendations} title="Recommended upgrades" tone="default" />
        <ListPanel icon={GitBranch} items={analysis.architecture_signals} title="Architecture signals" tone="default" />
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value }: Readonly<{ icon: typeof Star; label: string; value: string }>) {
  return (
    <div className="min-w-0 border-b border-r border-border p-3 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground"><Icon className="h-3 w-3 text-[#D9473F]" />{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function ListPanel({ icon: Icon, items, title, tone }: Readonly<{ icon: typeof Star; items: string[]; title: string; tone: "positive" | "negative" | "accent" | "default" }>) {
  const color = { positive: "text-[#167D87]", negative: "text-[#D9473F]", accent: "text-[#B66A0A]", default: "text-[#4d545e]" }[tone];
  return (
    <section className="border-b border-border p-5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 sm:p-6">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase text-foreground"><Icon className={`h-4 w-4 ${color}`} />{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm leading-6 text-muted-foreground">{items.length ? items.map((item) => <li className="flex items-start gap-2" key={item}><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "negative" ? "bg-[#FF5A4E]" : tone === "positive" ? "bg-[#2BC3CE]" : "bg-[#89909A]"}`} />{item}</li>) : <li>None detected</li>}</ul>
    </section>
  );
}

function AuditSignal({ active, icon: Icon, label }: Readonly<{ active: boolean; icon: typeof Star; label: string }>) {
  return (
    <div className={active ? "flex items-center gap-2 rounded-md border border-[#b7e7ea] bg-[#effbfc] px-2.5 py-2 text-xs font-bold text-[#167D87]" : "flex items-center gap-2 rounded-md border border-border bg-white px-2.5 py-2 text-xs font-bold text-muted-foreground"}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {active ? <Check className="ml-auto h-3 w-3" /> : null}
    </div>
  );
}

function AnalyzerStatus({ state, text }: Readonly<{ state: AnalyzeState; text: string }>) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-muted-foreground">
      <span className={state === "error" ? "h-2 w-2 rounded-full bg-[#FF5A4E]" : state === "analyzing" ? "h-2 w-2 animate-pulse rounded-full bg-[#F0A13A]" : "h-2 w-2 rounded-full bg-[#2BC3CE]"} />
      {text}
    </div>
  );
}

function CoverageSignal({ icon: Icon, label, value }: Readonly<{ icon: typeof GitFork; label: string; value: number }>) {
  return (
    <div className="border-b border-r border-white/10 p-5 even:border-r-0 last:border-b-0 [&:nth-last-child(2)]:border-b-0">
      <Icon className="h-4 w-4 text-[#2BC3CE]" />
      <dd className="mt-3 text-2xl font-bold text-white">{value}</dd>
      <dt className="mt-1 text-[10px] font-bold uppercase text-white/42">{label}</dt>
    </div>
  );
}
