"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  BrainCircuit,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  Mic2,
  RefreshCw,
  ScanSearch,
  Sparkles,
  Star,
  Target,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { Reveal } from "@/components/motion";
import { useTranslations } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import { Button } from "@/components/ui/button";
import type {
  InterviewPrepData,
  InterviewPrepQuestion,
  InterviewPrepScript,
  InterviewPrepSection,
  InterviewPrepStarTemplate,
} from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";

type InterviewPrepViewProps = {
  apiBaseUrl: string;
  initialPrep: InterviewPrepData;
};

type PrepState = "ready" | "regenerating" | "error";

const SECTION_LABELS: Record<InterviewPrepSection, string> = {
  technical_questions: "Technical Questions",
  behavioral_questions: "Behavioral Questions",
  english_self_introduction: "English Self-Introduction",
  project_explanation_script: "Project Explanation",
  why_this_company: "Why This Company",
  why_this_role: "Why This Role",
  star_answer_templates: "STAR Templates",
  weak_area_drill_questions: "Weak-Area Drills",
};

export function InterviewPrepView({ apiBaseUrl, initialPrep }: InterviewPrepViewProps) {
  const [prep, setPrep] = useState(initialPrep);
  const [state, setState] = useState<PrepState>("ready");
  const [activeSection, setActiveSection] = useState<InterviewPrepSection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const t = useTranslations();

  async function regenerateSection(section: InterviewPrepSection) {
    try {
      setState("regenerating");
      setActiveSection(section);
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/interview-prep/${prep.application.id}/regenerate`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ sections: [section] }),
      });

      if (!response.ok) {
        throw await apiError(response, t("Regeneration failed"));
      }

      setPrep((await response.json()) as InterviewPrepData);
      setState("ready");
      setActiveSection(null);
    } catch (error) {
      setState("error");
      setActiveSection(null);
      setErrorMessage(error instanceof Error ? t(error.message) : t("Regeneration failed."));
    }
  }

  const content = prep.content;
  const isBusy = (section: InterviewPrepSection) => state === "regenerating" && activeSection === section;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={<Link className="motion-control inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3.5 text-xs font-bold text-foreground hover:border-[#FF5A4E] hover:text-[#D9473F]" href={`/jobs/${prep.application.job_post_id}/analysis`}><ArrowLeft className="h-4 w-4" />{t("Back to analysis")}</Link>}
        description={`${prep.job.company_name}${prep.job.domain ? ` / ${prep.job.domain}` : ""}`}
        eyebrow={t("Interview room")}
        icon={Mic2}
        title={prep.job.title}
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[52%] opacity-45" compact />
        <div className="relative grid lg:grid-cols-[1fr_430px]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]"><Sparkles className="h-3.5 w-3.5" />{t("Grounded preparation brief")}</div>
            <h2 className="mt-4 text-2xl font-bold">{t("Practice with evidence from your real profile")}</h2>
            <div className="mt-4 flex flex-wrap gap-2">{prep.focus_areas.map((area) => <span className="rounded-md border border-white/[0.12] bg-white/[0.07] px-2.5 py-1.5 text-xs font-semibold text-white/[0.72]" key={area}>{area}</span>)}</div>
          </div>
          <div className="grid grid-cols-3 border-t border-white/[0.10] lg:border-l lg:border-t-0">
            <PrepMetric label={t("Technical")} value={content.technical_questions.length.toString()} />
            <PrepMetric label={t("Behavioral")} value={content.behavioral_questions.length.toString()} />
            <PrepMetric label={t("Drills")} value={content.weak_area_drill_questions.length.toString()} />
          </div>
        </div>
      </Reveal>

      <AnimatePresence initial={false}>
        {errorMessage ? <motion.div animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 rounded-md border border-[#f0b5b0] bg-[#fff3f2] p-4 text-sm font-semibold text-[#A63832]" exit={{ opacity: 0, y: -4 }} initial={{ opacity: 0, y: -4 }} role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{errorMessage}</motion.div> : null}
      </AnimatePresence>

      <nav aria-label={t("Interview prep sections")} className="flex gap-1 overflow-x-auto border-b border-border">
        {[["#scripts", "Scripts"], ["#technical", "Technical"], ["#behavioral", "Behavioral"], ["#star", "STAR"], ["#drills", "Weak-area drills"]].map(([href, label]) => <a className="motion-control whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-bold text-muted-foreground hover:border-[#FF5A4E] hover:text-foreground" href={href} key={href}>{t(label)}</a>)}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <main className="min-w-0 space-y-6">
          <section className="space-y-6" id="scripts">
            <ScriptSection icon={UserRound} isBusy={isBusy("english_self_introduction")} onRegenerate={() => void regenerateSection("english_self_introduction")} script={content.english_self_introduction} title={t(SECTION_LABELS.english_self_introduction)} />
            <ScriptSection icon={Code2} isBusy={isBusy("project_explanation_script")} onRegenerate={() => void regenerateSection("project_explanation_script")} script={content.project_explanation_script} title={t(SECTION_LABELS.project_explanation_script)} />
            <div className="grid gap-6 lg:grid-cols-2">
              <ScriptSection icon={Building2} isBusy={isBusy("why_this_company")} onRegenerate={() => void regenerateSection("why_this_company")} script={content.why_this_company} title={t(SECTION_LABELS.why_this_company)} />
              <ScriptSection icon={Target} isBusy={isBusy("why_this_role")} onRegenerate={() => void regenerateSection("why_this_role")} script={content.why_this_role} title={t(SECTION_LABELS.why_this_role)} />
            </div>
          </section>

          <div id="technical"><QuestionSection icon={BrainCircuit} isBusy={isBusy("technical_questions")} onRegenerate={() => void regenerateSection("technical_questions")} questions={content.technical_questions} title={t(SECTION_LABELS.technical_questions)} /></div>
          <div id="behavioral"><QuestionSection icon={MessageSquareText} isBusy={isBusy("behavioral_questions")} onRegenerate={() => void regenerateSection("behavioral_questions")} questions={content.behavioral_questions} title={t(SECTION_LABELS.behavioral_questions)} /></div>
        </main>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <div id="star"><StarSection isBusy={isBusy("star_answer_templates")} onRegenerate={() => void regenerateSection("star_answer_templates")} templates={content.star_answer_templates} /></div>
          <div id="drills"><QuestionSection compact icon={ScanSearch} isBusy={isBusy("weak_area_drill_questions")} onRegenerate={() => void regenerateSection("weak_area_drill_questions")} questions={content.weak_area_drill_questions} title={t(SECTION_LABELS.weak_area_drill_questions)} /></div>
        </aside>
      </div>
    </div>
  );
}

function ScriptSection({ icon: Icon, isBusy, onRegenerate, script, title }: Readonly<{ icon: LucideIcon; isBusy: boolean; onRegenerate: () => void; script: InterviewPrepScript; title: string }>) {
  return (
    <Reveal className="app-surface overflow-hidden">
      <SectionHeader icon={Icon} isBusy={isBusy} onRegenerate={onRegenerate} title={title} />
      <AnimatePresence initial={false} mode="wait">
        <motion.div animate={{ opacity: 1, y: 0 }} className="p-5 sm:p-6" exit={{ opacity: 0, y: 4 }} initial={{ opacity: 0, y: 4 }} key={script.content} transition={{ duration: 0.2 }}>
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#4d545e]">{script.content}</p>
          <EvidenceList evidence={script.grounded_evidence} />
        </motion.div>
      </AnimatePresence>
    </Reveal>
  );
}

function QuestionSection({ compact = false, icon: Icon, isBusy, onRegenerate, questions, title }: Readonly<{ compact?: boolean; icon: LucideIcon; isBusy: boolean; onRegenerate: () => void; questions: InterviewPrepQuestion[]; title: string }>) {
  return (
    <Reveal className="app-surface overflow-hidden">
      <SectionHeader icon={Icon} isBusy={isBusy} onRegenerate={onRegenerate} title={title} />
      <div className="divide-y divide-border">
        {questions.map((question, index) => (
          <details className="group" key={question.question} open={!compact && index === 0}>
            <summary className="grid cursor-pointer list-none grid-cols-[30px_1fr_auto] items-start gap-3 px-5 py-4 transition hover:bg-[#f8f9fa] sm:px-6">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[#101318] text-[10px] font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
              <span className="pt-0.5 text-sm font-bold leading-6 text-foreground">{question.question}</span>
              <ChevronDown className="mt-1 h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-border bg-[#f8f9fa] px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3"><Lightbulb className="mt-1 h-4 w-4 shrink-0 text-[#D9473F]" /><p className="text-sm leading-7 text-muted-foreground">{question.guidance}</p></div>
              {question.related_skills.length ? <div className="mt-4 flex flex-wrap gap-2">{question.related_skills.map((skill) => <span className="data-chip" key={skill}>{skill}</span>)}</div> : null}
              <EvidenceList evidence={question.grounded_evidence} />
            </div>
          </details>
        ))}
      </div>
    </Reveal>
  );
}

function StarSection({ isBusy, onRegenerate, templates }: Readonly<{ isBusy: boolean; onRegenerate: () => void; templates: InterviewPrepStarTemplate[] }>) {
  const t = useTranslations();

  return (
    <Reveal className="app-surface overflow-hidden">
      <SectionHeader icon={Star} isBusy={isBusy} onRegenerate={onRegenerate} title={t(SECTION_LABELS.star_answer_templates)} />
      <div className="divide-y divide-border">
        {templates.map((template, index) => (
          <details className="group" key={template.prompt} open={index === 0}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 transition hover:bg-[#f8f9fa]"><span className="text-sm font-bold leading-6 text-foreground">{template.prompt}</span><ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" /></summary>
            <div className="border-t border-border bg-[#f8f9fa] p-5">
              <dl className="relative space-y-4 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-border">
                <StarItem label="S" name={t("Situation")} value={template.situation} />
                <StarItem label="T" name={t("Task")} value={template.task} />
                <StarItem label="A" name={t("Action")} value={template.action} />
                <StarItem label="R" name={t("Result")} value={template.result} />
              </dl>
              <EvidenceList evidence={template.grounded_evidence} />
            </div>
          </details>
        ))}
      </div>
    </Reveal>
  );
}

function SectionHeader({ icon: Icon, isBusy, onRegenerate, title }: Readonly<{ icon: LucideIcon; isBusy: boolean; onRegenerate: () => void; title: string }>) {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Icon className="h-4 w-4 text-[#D9473F]" />{title}</h2>
      <Button aria-label={t("Regenerate {section}", { section: title })} disabled={isBusy} onClick={onRegenerate} size="icon" title={t("Regenerate {section}", { section: title })} type="button" variant="ghost">{isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
    </div>
  );
}

function StarItem({ label, name, value }: Readonly<{ label: string; name: string; value: string }>) {
  return (
    <div className="relative grid grid-cols-[28px_1fr] gap-3">
      <dt className="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-[#101318] text-[10px] font-bold text-white">{label}</dt>
      <dd><p className="text-[10px] font-bold uppercase text-[#D9473F]">{name}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{value}</p></dd>
    </div>
  );
}

function EvidenceList({ evidence }: Readonly<{ evidence: string[] }>) {
  const t = useTranslations();
  if (!evidence.length) return null;
  return (
    <details className="group/evidence mt-5 border-t border-border pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-bold uppercase text-muted-foreground"><span className="flex items-center gap-2"><BookOpenCheck className="h-3.5 w-3.5 text-[#167D87]" />{t("Grounded evidence ({count})", { count: evidence.length })}</span><ChevronDown className="h-3.5 w-3.5 transition group-open/evidence:rotate-180" /></summary>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">{evidence.map((item) => <li className="flex items-start gap-2" key={item}><Check className="mt-1 h-3 w-3 shrink-0 text-[#167D87]" />{item}</li>)}</ul>
    </details>
  );
}

function PrepMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="flex flex-col justify-center border-r border-white/[0.10] p-5 last:border-r-0"><CircleHelp className="h-4 w-4 text-[#2BC3CE]" /><p className="mt-3 text-3xl font-bold text-white">{value}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/[0.42]">{label}</p></div>;
}
