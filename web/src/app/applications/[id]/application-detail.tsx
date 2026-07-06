"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationData, ApplicationStatus } from "@/lib/api";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "saved",
  "preparing",
  "applied",
  "assessment",
  "interview",
  "rejected",
  "offer",
  "archived",
];

type ApplicationDetailProps = {
  apiBaseUrl: string;
  backendToken: string;
  initialApplication: ApplicationData;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function ApplicationDetail({
  apiBaseUrl,
  backendToken,
  initialApplication,
}: ApplicationDetailProps) {
  const [application, setApplication] = useState(initialApplication);
  const [form, setForm] = useState({
    status: initialApplication.status,
    deadline: initialApplication.deadline ?? "",
    job_url: initialApplication.job_url ?? "",
    applied_date: initialApplication.applied_date ?? "",
    interview_date: initialApplication.interview_date ?? "",
    notes: initialApplication.notes ?? "",
    next_action: initialApplication.next_action ?? "",
  });
  const [state, setState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    }),
    [backendToken],
  );

  async function saveApplication() {
    try {
      setState("saving");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/applications/${application.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: form.status,
          deadline: emptyToNull(form.deadline),
          job_url: emptyToNull(form.job_url),
          applied_date: emptyToNull(form.applied_date),
          interview_date: emptyToNull(form.interview_date),
          notes: emptyToNull(form.notes),
          next_action: emptyToNull(form.next_action),
        }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}.`);
      }

      const updated = (await response.json()) as ApplicationData;
      setApplication(updated);
      setForm({
        status: updated.status,
        deadline: updated.deadline ?? "",
        job_url: updated.job_url ?? "",
        applied_date: updated.applied_date ?? "",
        interview_date: updated.interview_date ?? "",
        notes: updated.notes ?? "",
        next_action: updated.next_action ?? "",
      });
      setState("saved");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Application
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">
                {application.company}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{application.role}</p>
            </div>
            <span className="rounded-md bg-muted px-3 py-2 text-sm font-medium capitalize text-foreground">
              {application.status}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Tracker fields</h2>
            <Button disabled={state === "saving"} onClick={() => void saveApplication()} type="button">
              {state === "saving" ? "Saving" : "Save"}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as ApplicationStatus,
                  }))
                }
                value={form.status}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Deadline">
              <Input
                onChange={(event) =>
                  setForm((current) => ({ ...current, deadline: event.target.value }))
                }
                type="date"
                value={form.deadline}
              />
            </Field>
            <Field label="Applied date">
              <Input
                onChange={(event) =>
                  setForm((current) => ({ ...current, applied_date: event.target.value }))
                }
                type="date"
                value={form.applied_date}
              />
            </Field>
            <Field label="Interview date">
              <Input
                onChange={(event) =>
                  setForm((current) => ({ ...current, interview_date: event.target.value }))
                }
                type="date"
                value={form.interview_date}
              />
            </Field>
            <Field label="Job URL">
              <Input
                onChange={(event) =>
                  setForm((current) => ({ ...current, job_url: event.target.value }))
                }
                placeholder="https://company.com/jobs/role"
                value={form.job_url}
              />
            </Field>
            <Field label="Next action">
              <Input
                onChange={(event) =>
                  setForm((current) => ({ ...current, next_action: event.target.value }))
                }
                placeholder="Follow up after 7 days"
                value={form.next_action}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Label htmlFor="application-notes">Notes</Label>
            <Textarea
              className="mt-2 min-h-40"
              id="application-notes"
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              value={form.notes}
            />
          </div>

          {state === "saved" ? <p className="mt-3 text-sm text-emerald-700">Saved.</p> : null}
          {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">Linked workflow</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryItem label="Fit score" value={formatScore(application.fit_score)} />
            <SummaryItem label="Fit analysis" value={application.fit_analysis_id ? "Ready" : "-"} />
            <SummaryItem
              label="Interview prep"
              value={application.interview_prep_id ? "Generated" : "Not generated"}
            />
          </dl>
          <div className="mt-5 grid gap-2">
            <LinkButton href={`/jobs/${application.job_post_id}/analysis`}>Job analysis</LinkButton>
            <LinkButton href={`/interview-prep/${application.id}`}>Interview prep</LinkButton>
            {application.job_url ? (
              <a
                className="h-10 rounded-md border border-border bg-white px-4 py-2 text-center text-sm font-medium text-foreground"
                href={application.job_url}
                rel="noreferrer"
                target="_blank"
              >
                Job URL
              </a>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ children, label }: Readonly<{ children: ReactNode; label: string }>) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
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

function LinkButton({ children, href }: Readonly<{ children: ReactNode; href: string }>) {
  return (
    <Link
      className="h-10 rounded-md border border-border bg-white px-4 py-2 text-center text-sm font-medium text-foreground"
      href={href}
    >
      {children}
    </Link>
  );
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatScore(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`;
}
