"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Printer,
  Save,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { Reveal } from "@/components/motion";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { ScoreRing } from "@/components/score-ring";
import { SignalField } from "@/components/signal-field";
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
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={<Link className="motion-control inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3.5 text-xs font-bold text-foreground hover:border-[#FF5A4E] hover:text-[#D9473F]" href="/applications"><ArrowLeft className="h-4 w-4" />Back to pipeline</Link>}
        description={application.role}
        eyebrow="Application workspace"
        icon={BriefcaseBusiness}
        title={application.company}
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[50%] opacity-45" compact />
        <div className="relative grid lg:grid-cols-[1fr_390px]">
          <div className="flex min-h-[250px] flex-col justify-between border-b border-white/[0.10] p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]"><Target className="h-3.5 w-3.5" />Current next action</div>
              <h2 className="mt-4 max-w-2xl text-2xl font-bold leading-tight">{form.next_action || "Define the next concrete action for this opportunity."}</h2>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3"><StatusPill status={form.status} /><span className="text-xs font-semibold text-white/[0.45]">Deadline {formatDate(form.deadline || null)}</span></div>
          </div>
          <div className="relative flex items-center justify-center gap-7 p-6 sm:p-8">
            <ScoreRing className="w-36" label="Fit score" value={application.fit_score} />
            <div className="space-y-4"><HeroSignal label="Analysis" value={application.fit_analysis_id ? "Ready" : "Missing"} /><HeroSignal label="Prep" value={application.interview_prep_id ? "Ready" : "Open"} /></div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-6">
          <Reveal className="app-surface overflow-hidden" delay={0.04}>
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <SectionHeading description="Keep the stage, dates, source, and next action current." title="Tracker fields" />
              <Button disabled={state === "saving"} onClick={() => void saveApplication()} type="button">
                {state === "saving" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {state === "saving" ? "Saving" : "Save changes"}
              </Button>
            </div>

            <div className="border-b border-border bg-[#f8f9fa] px-5 py-4 sm:px-6">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Pipeline stage</p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {STATUS_OPTIONS.map((status) => <button aria-pressed={form.status === status} className={form.status === status ? "motion-control whitespace-nowrap rounded-md bg-[#101318] px-3 py-2 text-xs font-bold capitalize text-white" : "motion-control whitespace-nowrap rounded-md border border-border bg-white px-3 py-2 text-xs font-bold capitalize text-muted-foreground hover:border-[#FF5A4E] hover:text-foreground"} key={status} onClick={() => setForm((current) => ({ ...current, status }))} type="button">{status}</button>)}
              </div>
            </div>

            <div className="grid gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
              <Field icon={BookmarkCheck} label="Status"><Select onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ApplicationStatus }))} value={form.status}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</Select></Field>
              <Field icon={CalendarClock} label="Deadline"><Input onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} type="date" value={form.deadline} /></Field>
              <Field icon={CheckCircle2} label="Applied date"><Input onChange={(event) => setForm((current) => ({ ...current, applied_date: event.target.value }))} type="date" value={form.applied_date} /></Field>
              <Field icon={CalendarClock} label="Interview date"><Input onChange={(event) => setForm((current) => ({ ...current, interview_date: event.target.value }))} type="date" value={form.interview_date} /></Field>
              <Field icon={Link2} label="Job URL"><Input onChange={(event) => setForm((current) => ({ ...current, job_url: event.target.value }))} placeholder="https://company.com/jobs/role" value={form.job_url} /></Field>
              <Field icon={Target} label="Next action"><Input onChange={(event) => setForm((current) => ({ ...current, next_action: event.target.value }))} placeholder="Follow up after 7 days" value={form.next_action} /></Field>
            </div>

            <div className="border-t border-border p-5 sm:p-6">
              <Label className="flex items-center gap-2" htmlFor="application-notes"><MessageSquareText className="h-4 w-4 text-[#D9473F]" />Notes</Label>
              <Textarea className="mt-2 min-h-44 bg-[#fbfbfc]" id="application-notes" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Contacts, interview details, follow-up context, or decisions..." value={form.notes} />
              <AnimatePresence initial={false}>
                {state === "saved" ? <motion.p animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#167D87]" exit={{ opacity: 0 }} initial={{ opacity: 0, y: -3 }}><Check className="h-4 w-4" />Changes saved</motion.p> : null}
                {errorMessage ? <motion.p animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#A63832]" exit={{ opacity: 0 }} initial={{ opacity: 0, y: -3 }}><AlertTriangle className="h-4 w-4" />{errorMessage}</motion.p> : null}
              </AnimatePresence>
            </div>
          </Reveal>
        </main>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Reveal className="app-surface overflow-hidden" delay={0.06}>
            <div className="border-b border-border px-5 py-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><Gauge className="h-4 w-4" />Linked workflow</div></div>
            <dl className="divide-y divide-border text-sm">
              <SummaryItem label="Fit score" value={formatScore(application.fit_score)} />
              <SummaryItem label="Fit analysis" value={application.fit_analysis_id ? "Ready" : "Missing"} />
              <SummaryItem label="Interview prep" value={application.interview_prep_id ? "Generated" : "Not generated"} />
            </dl>
            <div className="grid gap-2 border-t border-border p-5">
              <LinkButton href={`/jobs/${application.job_post_id}/analysis`} icon={Gauge}>Job analysis</LinkButton>
              <LinkButton href={`/interview-prep/${application.id}`} icon={MessageSquareText}>Interview prep</LinkButton>
              {application.job_url ? <a className="motion-control flex h-10 items-center justify-between rounded-md border border-border bg-white px-3 text-sm font-bold text-foreground hover:border-[#FF5A4E] hover:text-[#D9473F]" href={application.job_url} rel="noreferrer" target="_blank"><span className="flex items-center gap-2"><Link2 className="h-4 w-4" />Job source</span><ExternalLink className="h-4 w-4" /></a> : null}
            </div>
          </Reveal>

          <Reveal className="overflow-hidden rounded-lg border border-[#272c33] bg-[#101318] p-5 text-white" delay={0.1}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#2BC3CE]"><FileText className="h-4 w-4" />Export application report</div>
            <p className="mt-3 text-sm leading-6 text-white/[0.52]">Includes fit evidence, gaps, next action, and interview preparation.</p>
            <div className="mt-5 grid gap-2">
              <Button onClick={downloadMarkdownReport} type="button"><Download className="h-4 w-4" />Download Markdown</Button>
              <Button className="border-white/[0.16] bg-white/[0.08] text-white hover:bg-white/[0.14]" onClick={printPdfReport} type="button" variant="secondary"><Printer className="h-4 w-4" />Print PDF</Button>
            </div>
          </Reveal>
        </aside>
      </div>

      <AnimatePresence>{toast ? <Toast message={toast.message} tone={toast.tone} /> : null}</AnimatePresence>
    </div>
  );
}

function Field({ children, icon: Icon, label }: Readonly<{ children: ReactNode; icon: LucideIcon; label: string }>) {
  return (
    <div>
      <Label className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#D9473F]" />{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold text-foreground">{value}</dd>
    </div>
  );
}

function LinkButton({ children, href, icon: Icon }: Readonly<{ children: ReactNode; href: string; icon: LucideIcon }>) {
  return (
    <Link className="motion-control flex h-10 items-center justify-between rounded-md border border-border bg-white px-3 text-sm font-bold text-foreground hover:border-[#FF5A4E] hover:text-[#D9473F]" href={href}><span className="flex items-center gap-2"><Icon className="h-4 w-4" />{children}</span><ArrowRight className="h-4 w-4" /></Link>
  );
}

function StatusPill({ status }: Readonly<{ status: ApplicationStatus }>) {
  return <span className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.08] px-3 py-1.5 text-xs font-bold capitalize text-white"><span className="h-2 w-2 rounded-full bg-[#2BC3CE]" />{status}</span>;
}

function HeroSignal({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="border-l border-white/[0.15] pl-3"><p className="text-sm font-bold text-white">{value}</p><p className="mt-0.5 text-[10px] font-bold uppercase text-white/[0.42]">{label}</p></div>;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatScore(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function Toast({ message, tone }: Readonly<{ message: string; tone: "success" | "error" }>) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={
        tone === "success"
          ? "fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-md border border-[#b7e7ea] bg-white px-4 py-3 text-sm font-bold text-[#167D87] shadow-lg min-[960px]:bottom-4"
          : "fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-md border border-[#f0b5b0] bg-white px-4 py-3 text-sm font-bold text-[#A63832] shadow-lg min-[960px]:bottom-4"
      }
      exit={{ opacity: 0, y: 8 }}
      initial={{ opacity: 0, y: 8 }}
      role="status"
    >
      {tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {message}
    </motion.div>
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
