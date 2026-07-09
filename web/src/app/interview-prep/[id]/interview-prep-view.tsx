"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type {
  InterviewPrepData,
  InterviewPrepQuestion,
  InterviewPrepScript,
  InterviewPrepSection,
  InterviewPrepStarTemplate,
} from "@/lib/api";

type InterviewPrepViewProps = {
  apiBaseUrl: string;
  backendToken: string;
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

export function InterviewPrepView({
  apiBaseUrl,
  backendToken,
  initialPrep,
}: InterviewPrepViewProps) {
  const [prep, setPrep] = useState(initialPrep);
  const [state, setState] = useState<PrepState>("ready");
  const [activeSection, setActiveSection] = useState<InterviewPrepSection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    }),
    [backendToken],
  );

  async function regenerateSection(section: InterviewPrepSection) {
    try {
      setState("regenerating");
      setActiveSection(section);
      setErrorMessage(null);
      const response = await fetch(
        `${apiBaseUrl}/interview-prep/${prep.application.id}/regenerate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ sections: [section] }),
        },
      );

      if (!response.ok) {
        throw new Error(`Regeneration failed with status ${response.status}.`);
      }

      setPrep((await response.json()) as InterviewPrepData);
      setState("ready");
      setActiveSection(null);
    } catch (error) {
      setState("error");
      setActiveSection(null);
      setErrorMessage(error instanceof Error ? error.message : "Regeneration failed.");
    }
  }

  const content = prep.content;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="app-surface p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="app-kicker">
                Interview Prep
              </p>
              <h1 className="app-title">{prep.job.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {prep.job.company_name}
                {prep.job.domain ? ` - ` : ""}
              </p>
            </div>
            <Link
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground"
              href={`/jobs/${prep.application.job_post_id}/analysis`}
            >
              Job analysis
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {prep.focus_areas.map((area) => (
              <span className="rounded-md bg-muted px-3 py-1 text-sm text-foreground" key={area}>
                {area}
              </span>
            ))}
          </div>
          {errorMessage ? <p className="mt-4 text-sm text-red-700">{errorMessage}</p> : null}
        </div>

        <ScriptSection
          isBusy={state === "regenerating" && activeSection === "english_self_introduction"}
          onRegenerate={() => void regenerateSection("english_self_introduction")}
          script={content.english_self_introduction}
          title={SECTION_LABELS.english_self_introduction}
        />
        <ScriptSection
          isBusy={state === "regenerating" && activeSection === "project_explanation_script"}
          onRegenerate={() => void regenerateSection("project_explanation_script")}
          script={content.project_explanation_script}
          title={SECTION_LABELS.project_explanation_script}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ScriptSection
            isBusy={state === "regenerating" && activeSection === "why_this_company"}
            onRegenerate={() => void regenerateSection("why_this_company")}
            script={content.why_this_company}
            title={SECTION_LABELS.why_this_company}
          />
          <ScriptSection
            isBusy={state === "regenerating" && activeSection === "why_this_role"}
            onRegenerate={() => void regenerateSection("why_this_role")}
            script={content.why_this_role}
            title={SECTION_LABELS.why_this_role}
          />
        </div>

        <QuestionSection
          isBusy={state === "regenerating" && activeSection === "technical_questions"}
          onRegenerate={() => void regenerateSection("technical_questions")}
          questions={content.technical_questions}
          title={SECTION_LABELS.technical_questions}
        />
        <QuestionSection
          isBusy={state === "regenerating" && activeSection === "behavioral_questions"}
          onRegenerate={() => void regenerateSection("behavioral_questions")}
          questions={content.behavioral_questions}
          title={SECTION_LABELS.behavioral_questions}
        />
      </section>

      <aside className="space-y-6">
        <StarSection
          isBusy={state === "regenerating" && activeSection === "star_answer_templates"}
          onRegenerate={() => void regenerateSection("star_answer_templates")}
          templates={content.star_answer_templates}
        />
        <QuestionSection
          isBusy={state === "regenerating" && activeSection === "weak_area_drill_questions"}
          onRegenerate={() => void regenerateSection("weak_area_drill_questions")}
          questions={content.weak_area_drill_questions}
          title={SECTION_LABELS.weak_area_drill_questions}
        />
      </aside>
    </div>
  );
}

function ScriptSection({
  isBusy,
  onRegenerate,
  script,
  title,
}: Readonly<{
  isBusy: boolean;
  onRegenerate: () => void;
  script: InterviewPrepScript;
  title: string;
}>) {
  return (
    <article className="app-surface p-5 sm:p-6">
      <SectionHeader isBusy={isBusy} onRegenerate={onRegenerate} title={title} />
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {script.content}
      </p>
      <EvidenceList evidence={script.grounded_evidence} />
    </article>
  );
}

function QuestionSection({
  isBusy,
  onRegenerate,
  questions,
  title,
}: Readonly<{
  isBusy: boolean;
  onRegenerate: () => void;
  questions: InterviewPrepQuestion[];
  title: string;
}>) {
  return (
    <article className="app-surface p-5 sm:p-6">
      <SectionHeader isBusy={isBusy} onRegenerate={onRegenerate} title={title} />
      <div className="mt-4 space-y-4">
        {questions.map((question) => (
          <div className="rounded-md border border-border px-4 py-3" key={question.question}>
            <h3 className="text-sm font-semibold leading-6 text-foreground">
              {question.question}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{question.guidance}</p>
            {question.related_skills.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {question.related_skills.map((skill) => (
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
            <EvidenceList evidence={question.grounded_evidence} />
          </div>
        ))}
      </div>
    </article>
  );
}

function StarSection({
  isBusy,
  onRegenerate,
  templates,
}: Readonly<{
  isBusy: boolean;
  onRegenerate: () => void;
  templates: InterviewPrepStarTemplate[];
}>) {
  return (
    <article className="app-surface p-5 sm:p-6">
      <SectionHeader
        isBusy={isBusy}
        onRegenerate={onRegenerate}
        title={SECTION_LABELS.star_answer_templates}
      />
      <div className="mt-4 space-y-4">
        {templates.map((template) => (
          <div className="rounded-md border border-border px-4 py-3" key={template.prompt}>
            <h3 className="text-sm font-semibold leading-6 text-foreground">{template.prompt}</h3>
            <dl className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
              <StarItem label="S" value={template.situation} />
              <StarItem label="T" value={template.task} />
              <StarItem label="A" value={template.action} />
              <StarItem label="R" value={template.result} />
            </dl>
            <EvidenceList evidence={template.grounded_evidence} />
          </div>
        ))}
      </div>
    </article>
  );
}

function SectionHeader({
  isBusy,
  onRegenerate,
  title,
}: Readonly<{
  isBusy: boolean;
  onRegenerate: () => void;
  title: string;
}>) {
  return (
    <div className="flex items-start justify-between gap-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <Button disabled={isBusy} onClick={onRegenerate} type="button" variant="secondary">
        {isBusy ? "Regenerating" : "Regenerate"}
      </Button>
    </div>
  );
}

function StarItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="font-semibold text-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EvidenceList({ evidence }: Readonly<{ evidence: string[] }>) {
  if (!evidence.length) {
    return null;
  }
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grounding</p>
      <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
        {evidence.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
