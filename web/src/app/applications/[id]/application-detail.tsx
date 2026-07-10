"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicationData, ApplicationStatus, InterviewPrepData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";

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
  initialApplication: ApplicationData;
  initialInterviewPrep: InterviewPrepData;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

export function ApplicationDetail({
  apiBaseUrl,
  initialApplication,
  initialInterviewPrep,
}: ApplicationDetailProps) {
  const [application, setApplication] = useState(initialApplication);
  const [interviewPrep] = useState(initialInterviewPrep);
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
  const [toast, setToast] = useState<ToastState>(null);
  async function saveApplication() {
    try {
      setState("saving");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/applications/${application.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
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
        throw await apiError(response, "Save failed");
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
      showToast("success", "Application saved.");
    } catch (error) {
      setState("error");
      const message = error instanceof Error ? error.message : "Save failed.";
      setErrorMessage(message);
      showToast("error", message);
    }
  }

  function downloadMarkdownReport() {
    const markdown = buildMarkdownReport(application, interviewPrep);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(application.company)}-${slugify(application.role)}-report.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("success", "Markdown report downloaded.");
  }

  function printPdfReport() {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      showToast("error", "Allow popups to export the PDF report.");
      return;
    }
    reportWindow.document.write(buildPrintableReport(application, interviewPrep));
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
    showToast("success", "PDF report opened. Choose Save as PDF in the print dialog.");
  }

  function showToast(tone: "success" | "error", message: string) {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="app-surface p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="app-kicker">
                Application
              </p>
              <h1 className="app-title">
                {application.company}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{application.role}</p>
            </div>
            <span className="rounded-md bg-muted px-3 py-2 text-sm font-medium capitalize text-foreground">
              {application.status}
            </span>
          </div>
        </div>

        <div className="app-surface p-5 sm:p-6">
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
        <div className="app-surface p-5 sm:p-6">
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

        <div className="app-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Export report</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Includes fit breakdown, missing skills, next action, and interview prep summary.
          </p>
          <div className="mt-5 grid gap-2">
            <Button onClick={downloadMarkdownReport} type="button">
              Download Markdown
            </Button>
            <Button onClick={printPdfReport} type="button" variant="secondary">
              Print PDF
            </Button>
          </div>
        </div>
      </aside>

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
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

function Toast({ message, tone }: Readonly<{ message: string; tone: "success" | "error" }>) {
  return (
    <div
      className={
        tone === "success"
          ? "fixed bottom-4 right-4 z-50 rounded-md border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 shadow"
          : "fixed bottom-4 right-4 z-50 rounded-md border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-700 shadow"
      }
      role="status"
    >
      {message}
    </div>
  );
}

function buildMarkdownReport(application: ApplicationData, prep: InterviewPrepData) {
  const lines = [
    `# ${application.company} - ${application.role}`,
    "",
    "## Application",
    `- Status: ${application.status}`,
    `- Fit score: ${formatScore(application.fit_score)}`,
    `- Deadline: ${application.deadline ?? "-"}`,
    `- Applied date: ${application.applied_date ?? "-"}`,
    `- Interview date: ${application.interview_date ?? "-"}`,
    `- Next action: ${application.next_action ?? "-"}`,
    `- Job URL: ${application.job_url ?? "-"}`,
    "",
    "## Fit Breakdown",
    ...fitComponentLines(application),
    "",
    "## Missing Skills",
    ...(application.missing_skills.length
      ? application.missing_skills.map((skill) => `- ${skill}`)
      : ["- No missing-skill signal found."]),
    "",
    "## Fit Feedback",
    ...fitFeedbackLines(application),
    "",
    "## Interview Prep Summary",
    `- Technical questions: ${prep.content.technical_questions.length}`,
    `- Behavioral questions: ${prep.content.behavioral_questions.length}`,
    `- Weak-area drills: ${prep.content.weak_area_drill_questions.length}`,
    "",
    "### English Self-Introduction",
    prep.content.english_self_introduction.content,
    "",
    "### Project Explanation",
    prep.content.project_explanation_script.content,
    "",
    "### Why This Company",
    prep.content.why_this_company.content,
    "",
    "### Why This Role",
    prep.content.why_this_role.content,
    "",
    "### Technical Questions",
    ...prep.content.technical_questions.map((question) => `- ${question.question}`),
    "",
    "### Weak-Area Drills",
    ...prep.content.weak_area_drill_questions.map((question) => `- ${question.question}`),
    "",
    "## Notes",
    application.notes ?? "-",
    "",
  ];
  return lines.join("\n");
}

function buildPrintableReport(application: ApplicationData, prep: InterviewPrepData) {
  const markdown = buildMarkdownReport(application, prep);
  const body = markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) {
        return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      }
      if (line.startsWith("## ")) {
        return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      }
      if (line.startsWith("### ")) {
        return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      }
      if (line.startsWith("- ")) {
        return `<p class="bullet">${escapeHtml(line)}</p>`;
      }
      if (!line.trim()) {
        return "<br />";
      }
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(application.company)} report</title>
    <style>
      body { color: #111827; font-family: Arial, sans-serif; line-height: 1.5; padding: 32px; }
      h1 { font-size: 28px; margin: 0 0 20px; }
      h2 { border-top: 1px solid #e5e7eb; font-size: 18px; margin: 22px 0 8px; padding-top: 14px; }
      h3 { font-size: 15px; margin: 16px 0 6px; }
      p { font-size: 12px; margin: 4px 0; }
      .bullet { margin-left: 14px; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function fitComponentLines(application: ApplicationData) {
  const components = application.fit_components;
  if (!components) {
    return ["- No fit breakdown available."];
  }
  return [
    `- Skill match: ${formatScore(components.skill_score)}`,
    `- Project relevance: ${formatScore(components.project_relevance_score)}`,
    `- Experience: ${formatScore(components.experience_score)}`,
    `- Education: ${formatScore(components.education_score)}`,
    `- Language: ${formatScore(components.language_score)}`,
    `- Domain: ${formatScore(components.domain_score)}`,
    `- Profile quality: ${formatScore(components.profile_quality_score)}`,
  ];
}

function fitFeedbackLines(application: ApplicationData) {
  const explanation = application.fit_explanation;
  if (!explanation) {
    return ["- No fit feedback available."];
  }
  return [
    "- Strong matches:",
    ...explanation.strong_matches.map((item) => `  - ${item}`),
    "- Weak areas:",
    ...explanation.weak_areas.map((item) => `  - ${item}`),
    `- Recommended action: ${explanation.recommended_action}`,
  ];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
