"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobPostData } from "@/lib/api";

const jobPostSchema = z.object({
  content: z.string().trim().min(40),
});

type JobPostFormProps = {
  apiBaseUrl: string;
  backendToken: string;
};

type AnalyzeState = "idle" | "analyzing" | "error";

export function JobPostForm({ apiBaseUrl, backendToken }: JobPostFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [state, setState] = useState<AnalyzeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    }),
    [backendToken],
  );

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
        headers,
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed with status ${response.status}.`);
      }

      const jobPost = (await response.json()) as JobPostData;
      router.push(`/jobs/${jobPost.id}/analysis`);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Analysis failed.");
    }
  }

  return (
    <div className="rounded-md border border-border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Jobs</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">New job analysis</h1>
        </div>
        <span className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground">
          {state === "analyzing" ? "Analyzing" : "Ready"}
        </span>
      </div>

      <div className="mt-6">
        <Label htmlFor="job-post">Job post</Label>
        <Textarea
          className="mt-2 min-h-[520px]"
          id="job-post"
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste the full internship job description..."
          value={content}
        />
      </div>

      {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}

      <div className="mt-5 flex justify-end">
        <Button
          disabled={state === "analyzing"}
          onClick={() => void analyzeJobPost()}
          type="button"
        >
          Analyze job
        </Button>
      </div>
    </div>
  );
}
