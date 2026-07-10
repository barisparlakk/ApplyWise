"use client";

import { useState } from "react";
import { z } from "zod";

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

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-lg border border-[#1d4b42] bg-[#10221f] text-white shadow-[0_14px_32px_rgba(15,38,33,0.18)]">
        <div className="grid gap-7 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#a9c1ba]">Project evidence</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Make the depth of your work visible.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c5d8d2]">
              Add the repositories that best represent how you build, test, document, and ship software.
            </p>
          </div>
          <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a9c1ba]">Repository status</p>
            <p className="mt-2 text-xl font-semibold">{statusText}</p>
            <p className="mt-2 text-sm text-[#c5d8d2]">{repositories.length} analyzed repositories</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-6">
          <section className="app-surface p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Analyze a repository</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Use a public GitHub URL, owner/repository reference, or SSH remote.</p>
              </div>
              <span className="data-chip">GitHub</span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="repo-url">Repository source</Label>
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
                {state === "analyzing" ? "Analyzing" : "Analyze repository"}
              </Button>
            </div>
            {errorMessage ? <p className="mt-3 text-sm font-medium text-[#a34c47]">{errorMessage}</p> : null}
          </section>

          <div className="space-y-4">
            {repositories.map((repository) => (
              <RepositoryCard key={repository.id} repository={repository} />
            ))}
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="app-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Repository coverage</h2>
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
          </section>
        </aside>
      </div>
    </div>
  );
}

function RepositoryCard({ repository }: Readonly<{ repository: GitHubRepositoryData }>) {
  const analysis = repository.analysis;

  return (
    <article className="app-surface app-surface-hover p-5 sm:p-6">
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
