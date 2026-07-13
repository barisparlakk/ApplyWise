"use client";

import {
  AlertTriangle,
  BrainCircuit,
  Check,
  ClipboardPaste,
  Eye,
  Gauge,
  Globe2,
  Layers3,
  Link2,
  MessageSquareText,
  Radar,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { MotionBar, Reveal } from "@/components/motion";
import { useTranslations } from "@/components/locale-provider";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobPostData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";

const jobPostSchema = z.object({
  content: z.string().trim().min(40).max(50000),
});

const jobImportSchema = z.object({
  source_url: z.string().trim().url().refine(isSupportedJobUrl),
});

type JobPostFormProps = {
  apiBaseUrl: string;
};

type AnalyzeState = "idle" | "analyzing" | "error";
type SourceMode = "paste" | "import";

const OUTPUT_SIGNALS = [
  { icon: Target, label: "Role and seniority" },
  { icon: Wrench, label: "Required skills" },
  { icon: Eye, label: "Hidden expectations" },
  { icon: Gauge, label: "Fit components" },
  { icon: BrainCircuit, label: "Preparation gaps" },
];

export function JobPostForm({ apiBaseUrl }: JobPostFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("paste");
  const [state, setState] = useState<AnalyzeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const t = useTranslations();
  const trimmedLength = content.trim().length;
  const isImportReady = jobImportSchema.safeParse({ source_url: sourceUrl }).success;
  const isReady = sourceMode === "paste" ? trimmedLength >= 40 : isImportReady;
  const sourceProgress = sourceMode === "paste" ? Math.min(100, (trimmedLength / 800) * 100) : isImportReady ? 100 : 0;

  async function analyzeJobPost() {
    const parsed = jobPostSchema.safeParse({ content });
    if (!parsed.success) {
      setState("error");
      setErrorMessage(t("Paste a complete job post before analyzing."));
      return;
    }

    try {
      setState("analyzing");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/jobs/analyze`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw await apiError(response, t("Analysis failed"));
      }

      const jobPost = (await response.json()) as JobPostData;
      router.push(`/jobs/${jobPost.id}/analysis`);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? t(error.message) : t("Analysis failed."));
    }
  }

  async function importJobPost() {
    const parsed = jobImportSchema.safeParse({ source_url: sourceUrl });
    if (!parsed.success) {
      setState("error");
      setErrorMessage(t("Enter a supported public Greenhouse or Lever job URL."));
      return;
    }

    try {
      setState("analyzing");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/jobs/import`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw await apiError(response, t("Import failed"));
      }

      const jobPost = (await response.json()) as JobPostData;
      router.push(`/jobs/${jobPost.id}/analysis`);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? t(error.message) : t("Import failed."));
    }
  }

  function submitSource() {
    return sourceMode === "paste" ? analyzeJobPost() : importJobPost();
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={<SourceStatus ready={isReady} state={state} />}
        description={t("Paste the original listing so every score and recommendation stays tied to the same source evidence.")}
        eyebrow={t("Role intelligence")}
        icon={Radar}
        title={t("Turn a job post into a decision")}
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[52%] opacity-45" compact />
        <div className="relative grid lg:grid-cols-[1fr_420px]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]"><ScanSearch className="h-3.5 w-3.5" />{t("Role scan intake")}</div>
            <h2 className="mt-4 text-2xl font-bold">{sourceMode === "import" ? (isReady ? t("Public source is ready for import") : t("Add an official job posting URL")) : (isReady ? t("Source is ready for analysis") : t("Paste the complete role listing"))}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/[0.55]">{sourceMode === "import" ? t("Supported public sources use their official read-only job APIs.") : t("Include responsibilities, requirements, company context, location, and language expectations when available.")}</p>
          </div>
          <div className="border-t border-white/[0.10] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase text-white/[0.45]">{sourceMode === "import" ? t("Official source") : t("Source depth")}</p><p className="mt-2 text-4xl font-bold">{sourceMode === "import" ? (isImportReady ? "01" : "00") : trimmedLength}</p></div>
              <span className="text-xs font-semibold text-white/[0.48]">{sourceMode === "import" ? t("source selected") : t("characters captured")}</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.10]"><MotionBar className={isReady ? "bg-[#2BC3CE]" : "bg-[#FF5A4E]"} value={sourceProgress} /></div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal className="app-surface overflow-hidden" delay={0.04}>
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <SectionHeading description={sourceMode === "paste" ? t("The full listing produces a more reliable structured breakdown.") : t("Import one published posting through the source's official public API.")} title={sourceMode === "paste" ? t("Job description") : t("Published job URL")} />
            <div aria-label={t("Job source mode")} className="flex shrink-0 rounded-md border border-border bg-[#f7f8f9] p-1">
              <button aria-pressed={sourceMode === "paste"} className={sourceMode === "paste" ? "flex items-center gap-2 rounded-sm bg-[#101318] px-3 py-2 text-xs font-bold text-white" : "flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"} onClick={() => { setSourceMode("paste"); setErrorMessage(null); setState("idle"); }} type="button"><ClipboardPaste className="h-3.5 w-3.5" />{t("Paste")}</button>
              <button aria-pressed={sourceMode === "import"} className={sourceMode === "import" ? "flex items-center gap-2 rounded-sm bg-[#101318] px-3 py-2 text-xs font-bold text-white" : "flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"} onClick={() => { setSourceMode("import"); setErrorMessage(null); setState("idle"); }} type="button"><Globe2 className="h-3.5 w-3.5" />{t("Import")}</button>
            </div>
          </div>
          {sourceMode === "paste" ? (
            <div className="relative p-5 sm:p-6">
              {state === "analyzing" && !reduceMotion ? (
                <motion.div aria-hidden="true" animate={{ top: [24, 430, 24] }} className="pointer-events-none absolute inset-x-6 z-10 h-px bg-[#FF5A4E] shadow-[0_0_18px_rgba(255,90,78,0.55)]" transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }} />
              ) : null}
              <Label htmlFor="job-post">{t("Original listing")}</Label>
              <Textarea className="mt-2 min-h-[470px] resize-y bg-[#fbfbfc] text-[15px] leading-7" id="job-post" onChange={(event) => setContent(event.target.value)} placeholder={t("Paste the full internship job description here...")} value={content} />
            </div>
          ) : (
            <div className="flex min-h-[522px] items-center p-5 sm:p-8">
              <div className="mx-auto w-full max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><Link2 className="h-4 w-4" />{t("Public posting")}</div>
                <Label className="mt-5 block" htmlFor="job-source-url">{t("Greenhouse or Lever URL")}</Label>
                <div className="relative mt-2"><Globe2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" id="job-source-url" onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://jobs.lever.co/company/posting-id" type="url" value={sourceUrl} /></div>
                <div className="mt-6 grid border-y border-border sm:grid-cols-2">
                  <div className="border-b border-border py-4 sm:border-b-0 sm:border-r sm:pr-5"><p className="text-sm font-bold text-foreground">Greenhouse</p><p className="mt-1 text-xs text-muted-foreground">boards.greenhouse.io</p></div>
                  <div className="py-4 sm:pl-5"><p className="text-sm font-bold text-foreground">Lever</p><p className="mt-1 text-xs text-muted-foreground">jobs.lever.co</p></div>
                </div>
                <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#167D87]" />{t("Only published job data is read. ApplyWise never submits an application to the source.")}</p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4 border-t border-border bg-[#f8f9fa] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div aria-live="polite" className="text-sm text-muted-foreground">
              <span className="flex items-center gap-2 font-semibold"><span className={isReady ? "h-2 w-2 rounded-full bg-[#2BC3CE]" : "h-2 w-2 rounded-full bg-[#F0A13A]"} />{sourceMode === "import" ? (isReady ? t("Ready to import public posting") : t("Waiting for a supported URL")) : (isReady ? t("Ready to extract role signals") : t("{count} more characters needed", { count: Math.max(0, 40 - trimmedLength) }))}</span>
              <AnimatePresence initial={false}>{errorMessage ? <motion.p animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-2 font-semibold text-[#A63832]" exit={{ opacity: 0, y: -3 }} initial={{ opacity: 0, y: -3 }}><AlertTriangle className="h-4 w-4" />{errorMessage}</motion.p> : null}</AnimatePresence>
            </div>
            <Button disabled={!isReady || state === "analyzing"} onClick={() => void submitSource()} type="button">
              {state === "analyzing" ? <ScanSearch className="h-4 w-4 animate-pulse" /> : <Sparkles className="h-4 w-4" />}
              {state === "analyzing" ? t("Analyzing role") : sourceMode === "import" ? t("Import and analyze") : t("Analyze role")}
            </Button>
          </div>
        </Reveal>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Reveal className="overflow-hidden rounded-lg border border-[#272c33] bg-[#101318] text-white" delay={0.06}>
            <div className="border-b border-white/[0.10] px-5 py-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#2BC3CE]"><Layers3 className="h-4 w-4" />{t("Analysis output")}</div></div>
            <ol className="divide-y divide-white/[0.10]">
              {OUTPUT_SIGNALS.map((signal, index) => {
                const Icon = signal.icon;
                return <li className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-5 py-4" key={signal.label}><span className="text-[10px] font-bold text-white/[0.35]">{String(index + 1).padStart(2, "0")}</span><span className="flex items-center gap-2 text-sm font-semibold text-white/[0.76]"><Icon className="h-4 w-4 text-[#FF786D]" />{t(signal.label)}</span><Check className="h-3.5 w-3.5 text-[#2BC3CE]" /></li>;
              })}
            </ol>
          </Reveal>

          <Reveal className="border-l-2 border-[#2BC3CE] bg-[#effbfc] px-5 py-5" delay={0.1}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#167D87]"><ShieldCheck className="h-4 w-4" />{t("Scoring guardrail")}</div>
            <p className="mt-3 text-sm leading-6 text-[#45505A]">{t("Fit numbers are computed from deterministic sub-scores. AI explains the result but cannot replace it.")}</p>
          </Reveal>

          <Reveal className="app-surface p-5" delay={0.14}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><MessageSquareText className="h-4 w-4" />{t("Source tip")}</div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("Company and role details in the original post improve domain matching and interview preparation.")}</p>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

function isSupportedJobUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && [
      "boards.greenhouse.io",
      "job-boards.greenhouse.io",
      "jobs.lever.co",
      "jobs.eu.lever.co",
    ].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function SourceStatus({ ready, state }: Readonly<{ ready: boolean; state: AnalyzeState }>) {
  const label = state === "analyzing" ? "Analyzing source" : ready ? "Ready to analyze" : "Waiting for source";
  const t = useTranslations();
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-muted-foreground">
      <span className={state === "analyzing" ? "h-2 w-2 animate-pulse rounded-full bg-[#F0A13A]" : ready ? "h-2 w-2 rounded-full bg-[#2BC3CE]" : "h-2 w-2 rounded-full bg-[#89909A]"} />
      {t(label)}
    </div>
  );
}
