"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Columns3,
  ListFilter,
  Plus,
  Search,
  Table2,
  Target,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MotionBar, Reveal } from "@/components/motion";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ApplicationData, ApplicationStatus } from "@/lib/api";
import { localeTag } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUS_COLUMNS: Array<{ status: ApplicationStatus; label: string }> = [
  { status: "saved", label: "Saved" },
  { status: "preparing", label: "Preparing" },
  { status: "applied", label: "Applied" },
  { status: "assessment", label: "Assessment" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
  { status: "archived", label: "Archived" },
];

const ACTIVE_STATUSES = new Set<ApplicationStatus>(["saved", "preparing", "applied", "assessment", "interview"]);

type ViewMode = "board" | "table";

export function ApplicationsWorkspace({ applications }: Readonly<{ applications: ApplicationData[] }>) {
  const [view, setView] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | ApplicationStatus>("all");
  const reduceMotion = useReducedMotion();
  const t = useTranslations();

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesQuery = !normalizedQuery || [application.company, application.role, application.next_action ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? ACTIVE_STATUSES.has(application.status) : application.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [applications, query, statusFilter]);

  const activeCount = applications.filter((application) => ACTIVE_STATUSES.has(application.status)).length;
  const upcomingCount = applications.filter((application) => isUpcoming(application.deadline) && ACTIVE_STATUSES.has(application.status)).length;
  const averageFit = averageFitValue(applications);
  const interviewCount = applications.filter((application) => application.status === "interview").length;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <PageHeader
        action={<Link className="motion-control inline-flex h-10 items-center gap-2 rounded-md bg-[#101318] px-4 text-sm font-bold text-white hover:bg-[#292d34]" href="/jobs/new"><Plus className="h-4 w-4 text-[#FF6B60]" />{t("Analyze role")}</Link>}
        description={t("Keep opportunities moving with one visible owner, stage, date, score, and next action.")}
        eyebrow={t("Application operations")}
        icon={BriefcaseBusiness}
        title={t("Application pipeline")}
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[46%] opacity-42" compact />
        <div className="relative grid grid-cols-2 lg:grid-cols-4">
          <PipelineMetric icon={Target} label={t("Active")} value={activeCount.toString()} />
          <PipelineMetric icon={CalendarClock} label={t("Upcoming")} value={upcomingCount.toString()} />
          <PipelineMetric icon={CheckCircle2} label={t("Interviews")} value={interviewCount.toString()} />
          <PipelineMetric icon={BriefcaseBusiness} label={t("Average fit")} value={averageFit === null ? "--" : `${Math.round(averageFit)}%`} />
        </div>
      </Reveal>

      <section className="app-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="grid flex-1 gap-3 sm:max-w-[600px] sm:grid-cols-[1fr_160px]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={t("Search applications")} className="pl-10" onChange={(event) => setQuery(event.target.value)} placeholder={t("Search company, role, or action")} value={query} /></div>
            <div className="relative"><ListFilter className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Select aria-label={t("Filter by status")} className="pl-10" onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}><option value="all">{t("All stages")}</option><option value="active">{t("Active only")}</option>{STATUS_COLUMNS.map((column) => <option key={column.status} value={column.status}>{t(column.label)}</option>)}</Select></div>
          </div>
          <div aria-label={t("Pipeline view")} className="flex rounded-md border border-border bg-[#f7f8f9] p-1">
            <ViewButton active={view === "board"} icon={Columns3} label={t("Board")} onClick={() => setView("board")} />
            <ViewButton active={view === "table"} icon={Table2} label={t("Table")} onClick={() => setView("table")} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border bg-[#f8f9fa] px-5 py-3 text-xs">
          <span className="font-semibold text-muted-foreground">{t("Showing {shown} of {total} opportunities", { shown: filtered.length, total: applications.length })}</span>
          {(query || statusFilter !== "all") ? <button className="font-bold text-[#D9473F] hover:text-foreground" onClick={() => { setQuery(""); setStatusFilter("all"); }} type="button">{t("Clear filters")}</button> : null}
        </div>

        <AnimatePresence initial={false} mode="wait">
          <motion.div animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: 4 }} initial={reduceMotion ? false : { opacity: 0, y: 4 }} key={view} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
            {view === "board" ? <BoardView applications={filtered} /> : <TableView applications={filtered} />}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function BoardView({ applications }: Readonly<{ applications: ApplicationData[] }>) {
  const t = useTranslations();

  return (
    <div className="overflow-x-auto p-4">
      <div className="flex min-h-[430px] min-w-max gap-3">
        {STATUS_COLUMNS.map((column) => {
          const items = applications.filter((item) => item.status === column.status);
          return (
            <section className="w-[282px] shrink-0 rounded-lg border border-border bg-[#f7f8f9]" key={column.status}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", statusDot(column.status))} /><h2 className="text-sm font-bold text-foreground">{t(column.label)}</h2></div>
                <span className="grid h-6 min-w-6 place-items-center rounded-md border border-border bg-white px-1 text-xs font-bold text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-3 p-3">
                {items.length ? items.map((application) => <ApplicationCard application={application} key={application.id} />) : <div className="grid min-h-28 place-items-center rounded-md border border-dashed border-[#cfd3d8] bg-white/[0.60] px-4 text-center text-xs leading-5 text-muted-foreground">{t("No opportunities in this stage")}</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TableView({ applications }: Readonly<{ applications: ApplicationData[] }>) {
  const t = useTranslations();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
        <thead className="bg-white text-[10px] uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-bold">{t("Opportunity")}</th><th className="px-4 py-3 font-bold">{t("Stage")}</th><th className="px-4 py-3 font-bold">{t("Deadline")}</th><th className="px-4 py-3 font-bold">{t("Fit")}</th><th className="px-4 py-3 font-bold">{t("Applied date")}</th><th className="px-4 py-3 font-bold">{t("Interview")}</th><th className="px-4 py-3 font-bold">{t("Next action")}</th><th aria-label={t("Open")} className="w-12 px-4 py-3" /></tr></thead>
        <tbody>{applications.length ? applications.map((application) => <ApplicationRow application={application} key={application.id} />) : <tr><td className="px-5 py-10 text-center text-muted-foreground" colSpan={8}>{t("No applications match the current filters.")}</td></tr>}</tbody>
      </table>
    </div>
  );
}

function ApplicationRow({ application }: Readonly<{ application: ApplicationData }>) {
  const locale = localeTag(useLocale());
  const t = useTranslations();

  return (
    <tr className="border-t border-border transition hover:bg-[#f8f9fa]">
      <td className="px-5 py-4"><Link className="block min-w-0" href={`/applications/${application.id}`}><span className="block truncate font-bold text-foreground hover:text-[#D9473F]">{application.company}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{application.role}</span></Link></td>
      <td className="px-4 py-4"><StatusBadge status={application.status} /></td>
      <td className="px-4 py-4 text-muted-foreground">{formatDate(application.deadline, locale)}</td>
      <td className="px-4 py-4"><FitSignal value={application.fit_score} /></td>
      <td className="px-4 py-4 text-muted-foreground">{formatDate(application.applied_date, locale)}</td>
      <td className="px-4 py-4 text-muted-foreground">{formatDate(application.interview_date, locale)}</td>
      <td className="max-w-[300px] truncate px-4 py-4 text-muted-foreground">{application.next_action ? t(application.next_action) : t("Not set")}</td>
      <td className="px-4 py-4"><Link aria-label={t("Open {company}", { company: application.company })} className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:border-[#FF5A4E] hover:text-[#D9473F]" href={`/applications/${application.id}`}><ArrowRight className="h-4 w-4" /></Link></td>
    </tr>
  );
}

function ApplicationCard({ application }: Readonly<{ application: ApplicationData }>) {
  const locale = localeTag(useLocale());
  const t = useTranslations();

  return (
    <Link className="group block overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(16,19,24,0.04)] transition hover:-translate-y-0.5 hover:border-[#b7bdc5] hover:shadow-[0_12px_24px_rgba(16,19,24,0.08)]" href={`/applications/${application.id}`}>
      <div className="h-1 bg-[#eceef1]"><MotionBar className={fitColor(application.fit_score)} value={application.fit_score ?? 0} /></div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-foreground group-hover:text-[#D9473F]">{application.company}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{application.role}</p></div><span className="text-sm font-bold text-foreground">{formatScore(application.fit_score)}</span></div>
        <div className="mt-4 border-t border-border pt-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">{t("Next action")}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#4d545e]">{application.next_action ? t(application.next_action) : t("Define the next action")}</p></div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground"><span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{formatDate(application.deadline, locale)}</span><span>{application.interview_prep_id ? t("Prep ready") : t("No prep")}</span></div>
      </div>
    </Link>
  );
}

function PipelineMetric({ icon: Icon, label, value }: Readonly<{ icon: typeof Target; label: string; value: string }>) {
  return <div className="relative border-b border-r border-white/[0.10] p-5 last:border-r-0 sm:p-6 lg:border-b-0"><Icon className="h-4 w-4 text-[#2BC3CE]" /><p className="mt-4 text-3xl font-bold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/[0.42]">{label}</p></div>;
}

function ViewButton({ active, icon: Icon, label, onClick }: Readonly<{ active: boolean; icon: typeof Columns3; label: string; onClick: () => void }>) {
  return <button aria-pressed={active} className={cn("motion-control flex h-8 items-center gap-2 rounded-sm px-3 text-xs font-bold", active ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={onClick} type="button"><Icon className="h-3.5 w-3.5" />{label}</button>;
}

function StatusBadge({ status }: Readonly<{ status: ApplicationStatus }>) {
  const t = useTranslations();
  return <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase", statusTone(status))}><span className={cn("h-1.5 w-1.5 rounded-full", statusDot(status))} />{t(status)}</span>;
}

function FitSignal({ value }: Readonly<{ value: number | null }>) {
  return <div className="flex items-center gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#eceef1]"><MotionBar className={fitColor(value)} value={value ?? 0} /></div><span className="font-bold text-foreground">{formatScore(value)}</span></div>;
}

function statusTone(status: ApplicationStatus) {
  const tones: Record<ApplicationStatus, string> = {
    saved: "bg-[#f0f1f3] text-[#4d545e]",
    preparing: "bg-[#fff3f2] text-[#A63832]",
    applied: "bg-[#effbfc] text-[#167D87]",
    assessment: "bg-[#fff6e8] text-[#9A5D10]",
    interview: "bg-[#e9f8f9] text-[#126B73]",
    rejected: "bg-[#f0f1f3] text-[#656C75]",
    offer: "bg-[#eaf7ef] text-[#277142]",
    archived: "bg-[#f0f1f3] text-[#656C75]",
  };
  return tones[status];
}

function statusDot(status: ApplicationStatus) {
  if (status === "preparing" || status === "rejected") return "bg-[#FF5A4E]";
  if (status === "applied" || status === "interview") return "bg-[#2BC3CE]";
  if (status === "assessment") return "bg-[#F0A13A]";
  if (status === "offer") return "bg-[#43A963]";
  return "bg-[#89909A]";
}

function fitColor(value: number | null) {
  if (value === null || value < 55) return "bg-[#FF5A4E]";
  if (value < 75) return "bg-[#F0A13A]";
  return "bg-[#2BC3CE]";
}

function averageFitValue(applications: ApplicationData[]) {
  const scores = applications.map((application) => application.fit_score).filter((score): score is number => score !== null);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

function isUpcoming(value: string | null) {
  if (!value) return false;
  const now = new Date();
  const deadline = new Date(`${value}T23:59:59`);
  const diff = deadline.getTime() - now.getTime();
  return diff >= 0 && diff <= 14 * 24 * 60 * 60 * 1000;
}

function formatScore(value: number | null) {
  return value === null ? "--" : `${Math.round(value)}%`;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "--";
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}
