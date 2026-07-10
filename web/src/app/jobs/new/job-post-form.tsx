"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

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
  "Role and seniority",
  "Required skills",
  "Hidden expectations",
  "Fit components",
  "Preparation gaps",
];

export function JobPostForm({ apiBaseUrl }: JobPostFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [state, setState] = useState<AnalyzeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trimmedLength = content.trim().length;
  const isReady = trimmedLength >= 40;

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
    <div className="space-y-6">
      <header className="overflow-hidden rounded-lg border border-[#1d4b42] bg-[#10221f] text-white shadow-[0_14px_32px_rgba(15,38,33,0.18)]">
        <div className="grid gap-7 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#a9c1ba]">Job intake</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Turn a job post into a decision.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c5d8d2]">
              Bring in the original description so your profile, CV, and projects can be evaluated against the same evidence.
            </p>
          </div>
          <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a9c1ba]">Source status</p>
            <p className="mt-2 text-xl font-semibold">{isReady ? "Ready to analyze" : "Waiting for job post"}</p>
            <p className="mt-2 text-sm text-[#c5d8d2]">{trimmedLength} characters captured</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="app-surface p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Job description</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Paste the full listing, including responsibilities and requirements.</p>
            </div>
            <span className="data-chip">Manual paste</span>
          </div>

          <div className="mt-6">
            <Label htmlFor="job-post">Original listing</Label>
            <Textarea
              className="mt-2 min-h-[440px] resize-y text-[15px] leading-7"
              id="job-post"
              onChange={(event) => setContent(event.target.value)}
              placeholder="Paste the full internship job description here..."
              value={content}
            />
          </div>

          <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="text-sm text-muted-foreground">
              {isReady ? "Ready to extract role signals." : `${Math.max(0, 40 - trimmedLength)} more characters needed.`}
              {errorMessage ? <p className="mt-1 font-medium text-[#a34c47]">{errorMessage}</p> : null}
            </div>
            <Button
              disabled={!isReady || state === "analyzing"}
              onClick={() => void analyzeJobPost()}
              type="button"
            >
              {state === "analyzing" ? "Analyzing role" : "Analyze role"}
            </Button>
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="app-surface p-5 sm:p-6">
            <p className="text-base font-semibold text-foreground">Analysis signals</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {OUTPUT_SIGNALS.map((signal) => (
                <span className="data-chip" key={signal}>{signal}</span>
              ))}
            </div>
          </section>

        </aside>
      </div>
    </div>
  );
}
