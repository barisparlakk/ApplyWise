"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GitHubRepositoryData } from "@/lib/api";

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
  backendToken: string;
  initialRepositories: GitHubRepositoryData[];
};

export function GitHubAnalyzer({
  apiBaseUrl,
  backendToken,
  initialRepositories,
}: GitHubAnalyzerProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [repositories, setRepositories] = useState(initialRepositories);
  const [state, setState] = useState<AnalyzeState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    }),
    [backendToken],
  );

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
        headers,
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail ?? `Analysis failed with status ${response.status}.`);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Projects
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">GitHub analyzer</h1>
            </div>
            <span className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground">
              {statusText}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <Label htmlFor="repo-url">GitHub repository URL</Label>
              <Input
                className="mt-2"
                id="repo-url"
                onChange={(event) => setRepoUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void analyzeRepository();
                  }
                }}
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
              />
            </div>
            <Button
              className="self-end"
              disabled={state === "analyzing"}
              onClick={() => void analyzeRepository()}
              type="button"
            >
              Analyze
            </Button>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
        </div>

        <div className="space-y-4">
          {repositories.map((repository) => (
            <RepositoryCard key={repository.id} repository={repository} />
          ))}
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">Repository Signals</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryItem label="Repositories" value={repositories.length.toString()} />
            <SummaryItem
              label="With tests"
              value={repositories.filter((repo) => repo.deterministic_signals.has_tests).length.toString()}
            />
            <SummaryItem
              label="With CI"
              value={repositories.filter((repo) => repo.deterministic_signals.has_ci).length.toString()}
            />
            <SummaryItem
              label="With Docker"
              value={repositories.filter((repo) => repo.deterministic_signals.has_docker).length.toString()}
            />
          </dl>
        </div>
      </aside>
    </div>
  );
}

function RepositoryCard({ repository }: Readonly<{ repository: GitHubRepositoryData }>) {
  const analysis = repository.analysis;

  return (
    <article className="rounded-md border border-border bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a
            className="text-xl font-semibold text-foreground hover:underline"
            href={repository.html_url}
            rel="noreferrer"
            target="_blank"
          >
            {repository.full_name}
          </a>
          {repository.description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{repository.description}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-64">
          <Metric label="Stars" value={repository.stars.toString()} />
          <Metric label="README" value={analysis.readme_quality} />
          <Metric label="Complexity" value={analysis.complexity} />
          <Metric label="Activity" value={analysis.commit_activity} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {analysis.tech_stack.map((item) => (
          <span className="rounded-md bg-muted px-3 py-1 text-sm text-foreground" key={item}>
            {item}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ListPanel items={analysis.strengths} title="Strengths" />
        <ListPanel items={analysis.weaknesses} title="Weaknesses" />
        <ListPanel items={analysis.best_fit_roles} title="Best roles" />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ListPanel items={analysis.recommendations} title="Recommendations" />
        <ListPanel items={analysis.architecture_signals} title="Architecture" />
      </div>
    </article>
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
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.length ? (
          items.map((item) => <li key={item}>{item}</li>)
        ) : (
          <li>None detected</li>
        )}
      </ul>
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
