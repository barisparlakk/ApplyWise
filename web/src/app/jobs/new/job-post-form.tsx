"use client";

import {
  AlertTriangle,
  BrainCircuit,
  Check,
  ClipboardPaste,
  Eye,
  Gauge,
  Layers3,
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
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobPostData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";

const jobPostSchema = z.object({
  content: z.string().trim().min(40).max(50000),
});

type JobPostFormProps = {
  apiBaseUrl: string;
};

type AnalyzeState = "idle" | "analyzing" | "error";

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
  const [state, setState] = useState<AnalyzeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const trimmedLength = content.trim().length;
  const isReady = trimmedLength >= 40;
  const sourceProgress = Math.min(100, (trimmedLength / 800) * 100);

  async function analyzeJobPost() {
    const parsed = jobPostSchema.safeParse({ content });
    if (!parsed.success) {
      setState("error");
      setErrorMessage("Paste a complete job post before analyzing.");
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
        throw await apiError(response, "Analysis failed");
      }

      const jobPost = (await response.json()) as JobPostData;
      router.push(`/jobs/${jobPost.id}/analysis`);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={<SourceStatus ready={isReady} state={state} />}
        description="Paste the original listing so every score and recommendation stays tied to the same source evidence."
        eyebrow="Role intelligence"
        icon={Radar}
        title="Turn a job post into a decision"
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[52%] opacity-45" compact />
        <div className="relative grid lg:grid-cols-[1fr_420px]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]"><ScanSearch className="h-3.5 w-3.5" />Role scan intake</div>
            <h2 className="mt-4 text-2xl font-bold">{isReady ? "Source is ready for analysis" : "Paste the complete role listing"}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/[0.55]">Include responsibilities, requirements, company context, location, and language expectations when available.</p>
          </div>
          <div className="border-t border-white/[0.10] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase text-white/[0.45]">Source depth</p><p className="mt-2 text-4xl font-bold">{trimmedLength}</p></div>
              <span className="text-xs font-semibold text-white/[0.48]">characters captured</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.10]"><MotionBar className={isReady ? "bg-[#2BC3CE]" : "bg-[#FF5A4E]"} value={sourceProgress} /></div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal className="app-surface overflow-hidden" delay={0.04}>
          <div className="border-b border-border p-5 sm:p-6">
            <SectionHeading action={<span className="data-chip"><ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />Manual source</span>} description="The full listing produces a more reliable structured breakdown." title="Job description" />
          </div>
          <div className="relative p-5 sm:p-6">
            {state === "analyzing" && !reduceMotion ? (
              <motion.div aria-hidden="true" animate={{ top: [24, 430, 24] }} className="pointer-events-none absolute inset-x-6 z-10 h-px bg-[#FF5A4E] shadow-[0_0_18px_rgba(255,90,78,0.55)]" transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }} />
            ) : null}
            <Label htmlFor="job-post">Original listing</Label>
            <Textarea className="mt-2 min-h-[470px] resize-y bg-[#fbfbfc] text-[15px] leading-7" id="job-post" onChange={(event) => setContent(event.target.value)} placeholder="Paste the full internship job description here..." value={content} />
          </div>
          <div className="flex flex-col gap-4 border-t border-border bg-[#f8f9fa] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div aria-live="polite" className="text-sm text-muted-foreground">
              <span className="flex items-center gap-2 font-semibold"><span className={isReady ? "h-2 w-2 rounded-full bg-[#2BC3CE]" : "h-2 w-2 rounded-full bg-[#F0A13A]"} />{isReady ? "Ready to extract role signals" : `${Math.max(0, 40 - trimmedLength)} more characters needed`}</span>
              <AnimatePresence initial={false}>{errorMessage ? <motion.p animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-2 font-semibold text-[#A63832]" exit={{ opacity: 0, y: -3 }} initial={{ opacity: 0, y: -3 }}><AlertTriangle className="h-4 w-4" />{errorMessage}</motion.p> : null}</AnimatePresence>
            </div>
            <Button disabled={!isReady || state === "analyzing"} onClick={() => void analyzeJobPost()} type="button">
              {state === "analyzing" ? <ScanSearch className="h-4 w-4 animate-pulse" /> : <Sparkles className="h-4 w-4" />}
              {state === "analyzing" ? "Analyzing role" : "Analyze role"}
            </Button>
          </div>
        </Reveal>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Reveal className="overflow-hidden rounded-lg border border-[#272c33] bg-[#101318] text-white" delay={0.06}>
            <div className="border-b border-white/[0.10] px-5 py-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#2BC3CE]"><Layers3 className="h-4 w-4" />Analysis output</div></div>
            <ol className="divide-y divide-white/[0.10]">
              {OUTPUT_SIGNALS.map((signal, index) => {
                const Icon = signal.icon;
                return <li className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-5 py-4" key={signal.label}><span className="text-[10px] font-bold text-white/[0.35]">{String(index + 1).padStart(2, "0")}</span><span className="flex items-center gap-2 text-sm font-semibold text-white/[0.76]"><Icon className="h-4 w-4 text-[#FF786D]" />{signal.label}</span><Check className="h-3.5 w-3.5 text-[#2BC3CE]" /></li>;
              })}
            </ol>
          </Reveal>

          <Reveal className="border-l-2 border-[#2BC3CE] bg-[#effbfc] px-5 py-5" delay={0.1}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#167D87]"><ShieldCheck className="h-4 w-4" />Scoring guardrail</div>
            <p className="mt-3 text-sm leading-6 text-[#45505A]">Fit numbers are computed from deterministic sub-scores. AI explains the result but cannot replace it.</p>
          </Reveal>

          <Reveal className="app-surface p-5" delay={0.14}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><MessageSquareText className="h-4 w-4" />Source tip</div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Company and role details in the original post improve domain matching and interview preparation.</p>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}

function SourceStatus({ ready, state }: Readonly<{ ready: boolean; state: AnalyzeState }>) {
  const label = state === "analyzing" ? "Analyzing source" : ready ? "Ready to analyze" : "Waiting for source";
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-muted-foreground">
      <span className={state === "analyzing" ? "h-2 w-2 animate-pulse rounded-full bg-[#F0A13A]" : ready ? "h-2 w-2 rounded-full bg-[#2BC3CE]" : "h-2 w-2 rounded-full bg-[#89909A]"} />
      {label}
    </div>
  );
}
