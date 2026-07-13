"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Plus,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { MotionBar } from "@/components/motion";
import { SectionHeading } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useTranslations } from "@/components/locale-provider";
import type { UserGoalData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";
import { localeTag } from "@/lib/i18n";

const goalSchema = z.object({
  title: z.string().trim().min(2).max(255),
  target_role: z.string().trim().max(120).optional(),
  target_date: z.string().optional(),
  weekly_application_target: z.coerce.number().int().min(1).max(50),
});

type GoalManagerProps = {
  apiBaseUrl: string;
  initialGoals: UserGoalData[];
};

export function GoalManager({ apiBaseUrl, initialGoals }: GoalManagerProps) {
  const [goals, setGoals] = useState(initialGoals);
  const [form, setForm] = useState({ title: "", target_role: "", target_date: "", weekly_application_target: "5" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locale = localeTag(useLocale());
  const t = useTranslations();

  async function createGoal() {
    const parsed = goalSchema.safeParse(form);
    if (!parsed.success) {
      setError(t("Complete the goal title and weekly target."));
      return;
    }
    try {
      setBusyId("new");
      setError(null);
      const response = await fetch(`${apiBaseUrl}/goals`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          ...parsed.data,
          target_role: parsed.data.target_role || null,
          target_date: parsed.data.target_date || null,
        }),
      });
      if (!response.ok) throw await apiError(response, t("Goal could not be created"));
      const created = (await response.json()) as UserGoalData;
      setGoals((current) => [created, ...current]);
      setForm({ title: "", target_role: "", target_date: "", weekly_application_target: "5" });
    } catch (requestError) {
      setError(requestError instanceof Error ? t(requestError.message) : t("Goal could not be created."));
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(goal: UserGoalData) {
    const nextStatus = goal.status === "completed" ? "active" : "completed";
    try {
      setBusyId(goal.id);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/goals/${goal.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw await apiError(response, t("Goal could not be updated"));
      const updated = (await response.json()) as UserGoalData;
      setGoals((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (requestError) {
      setError(requestError instanceof Error ? t(requestError.message) : t("Goal could not be updated."));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteGoal(goalId: string) {
    try {
      setBusyId(goalId);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/goals/${goalId}`, { method: "DELETE" });
      if (!response.ok) throw await apiError(response, t("Goal could not be deleted"));
      setGoals((current) => current.filter((goal) => goal.id !== goalId));
    } catch (requestError) {
      setError(requestError instanceof Error ? t(requestError.message) : t("Goal could not be deleted."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="app-surface overflow-hidden">
      <div className="border-b border-border p-5 sm:p-6">
        <SectionHeading description={t("Set a weekly application pace and a target role without turning activity into random volume.")} title={t("Application goals")} />
      </div>
      <div className="grid gap-4 border-b border-border bg-[#f8f9fa] p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[1.2fr_1fr_180px_150px_auto] lg:items-end">
        <div><Label htmlFor="goal-title">{t("Goal title")}</Label><Input className="mt-2" id="goal-title" maxLength={255} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder={t("Build a focused internship pipeline")} value={form.title} /></div>
        <div><Label htmlFor="goal-role">{t("Target role")}</Label><Input className="mt-2" id="goal-role" maxLength={120} onChange={(event) => setForm((current) => ({ ...current, target_role: event.target.value }))} placeholder={t("Backend Intern")} value={form.target_role} /></div>
        <div><Label htmlFor="goal-date">{t("Target date")}</Label><Input className="mt-2" id="goal-date" onChange={(event) => setForm((current) => ({ ...current, target_date: event.target.value }))} type="date" value={form.target_date} /></div>
        <div><Label htmlFor="goal-weekly">{t("Applications / week")}</Label><Input className="mt-2" id="goal-weekly" max={50} min={1} onChange={(event) => setForm((current) => ({ ...current, weekly_application_target: event.target.value }))} type="number" value={form.weekly_application_target} /></div>
        <Button aria-label={t("Add goal")} disabled={busyId === "new"} onClick={() => void createGoal()} size="icon" type="button"><Plus className={busyId === "new" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} /></Button>
      </div>

      {error ? <p className="flex items-center gap-2 border-b border-[#f0b5b0] bg-[#fff5f4] px-5 py-3 text-sm font-semibold text-[#A63832]" role="alert"><AlertTriangle className="h-4 w-4" />{error}</p> : null}

      <div className="divide-y divide-border">
        {goals.length ? goals.map((goal) => (
          <article className={goal.status === "completed" ? "grid gap-4 px-5 py-5 opacity-60 sm:px-6 lg:grid-cols-[1fr_260px_auto] lg:items-center" : "grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_260px_auto] lg:items-center"} key={goal.id}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Target className="h-4 w-4 text-[#D9473F]" /><h3 className="font-bold text-foreground">{goal.title}</h3><span className="data-chip">{t(goal.status)}</span></div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground"><span>{goal.target_role ?? t("All target roles")}</span>{goal.target_date ? <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(goal.target_date, locale)}</span> : null}</p>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-muted-foreground">{t("Weekly progress")}</span><span className="font-bold text-foreground">{goal.weekly_progress}/{goal.weekly_application_target}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eceef1]"><MotionBar className={goal.progress_percent >= 100 ? "bg-[#2BC3CE]" : "bg-[#FF5A4E]"} value={goal.progress_percent} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Button aria-label={goal.status === "completed" ? t("Reopen goal") : t("Complete goal")} disabled={busyId === goal.id} onClick={() => void changeStatus(goal)} size="icon" type="button" variant="secondary">{busyId === goal.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : goal.status === "completed" ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</Button>
              <Button aria-label={t("Delete goal")} disabled={busyId === goal.id} onClick={() => void deleteGoal(goal.id)} size="icon" type="button" variant="danger"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </article>
        )) : <div className="px-6 py-10 text-center"><Target className="mx-auto h-7 w-7 text-[#D9473F]" /><p className="mt-3 text-sm font-semibold text-muted-foreground">{t("No application goal yet.")}</p></div>}
      </div>
    </section>
  );
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}
