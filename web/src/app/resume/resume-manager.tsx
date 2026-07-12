"use client";

import {
  AlertTriangle,
  Braces,
  Check,
  ChevronDown,
  FileCheck2,
  FileText,
  GraduationCap,
  Layers3,
  ListChecks,
  Save,
  ScanSearch,
  Sparkles,
  UploadCloud,
  Wrench,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { DragEvent } from "react";
import { useState } from "react";
import { z } from "zod";

import { MotionBar, Reveal } from "@/components/motion";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedResumeData, ResumeData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const parsedResumeSchema = z.object({
  education: z.array(z.string().trim().min(1)),
  experience: z.array(z.string().trim().min(1)),
  skills: z.array(z.string().trim().min(1)),
  projects: z.array(z.string().trim().min(1)),
});

type SaveState = "idle" | "uploading" | "saving" | "saved" | "error";

type ResumeManagerProps = {
  apiBaseUrl: string;
  initialResume: ResumeData | null;
};

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values: string[]): string {
  return values.join("\n");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("File could not be read."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

export function ResumeManager({
  apiBaseUrl,
  initialResume,
}: ResumeManagerProps) {
  const [resume, setResume] = useState<ResumeData | null>(initialResume);
  const [parsedData, setParsedData] = useState<ParsedResumeData>(
    initialResume?.parsed_data ?? {
      education: [],
      experience: [],
      skills: [],
      projects: [],
    },
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const reduceMotion = useReducedMotion();

  async function uploadResume(file: File | null) {
    if (!file) {
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx")) {
      setErrorMessage("Upload a PDF or DOCX file.");
      setSaveState("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Upload a file that is 10 MB or smaller.");
      setSaveState("error");
      return;
    }

    try {
      setSaveState("uploading");
      setErrorMessage(null);
      const contentBase64 = await fileToBase64(file);
      const response = await fetch(`${apiBaseUrl}/resume/upload`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          filename: file.name,
          content_base64: contentBase64,
        }),
      });

      if (!response.ok) {
        throw await apiError(response, "Upload failed");
      }

      const uploadedResume = (await response.json()) as ResumeData;
      setResume(uploadedResume);
      setParsedData(uploadedResume.parsed_data);
      setSaveState("saved");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
      setSaveState("error");
    }
  }

  async function saveCorrections() {
    if (!resume) {
      return;
    }

    const parsed = parsedResumeSchema.safeParse(parsedData);
    if (!parsed.success) {
      setErrorMessage("Each section needs at least one complete entry.");
      setSaveState("error");
      return;
    }

    try {
      setSaveState("saving");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/resume/${resume.id}`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw await apiError(response, "Save failed");
      }

      const updatedResume = (await response.json()) as ResumeData;
      setResume(updatedResume);
      setParsedData(updatedResume.parsed_data);
      setSaveState("saved");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Save failed.");
      setSaveState("error");
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void uploadResume(event.dataTransfer.files[0] ?? null);
  }

  const status = {
    idle: resume ? "Ready for review" : "No CV uploaded",
    uploading: "Parsing CV",
    saving: "Saving corrections",
    saved: "CV indexed",
    error: "Needs attention",
  }[saveState];
  const populatedSectionCount = Object.values(parsedData).filter(
    (values) => values.length > 0,
  ).length;
  const missingSectionLabels = Object.entries(parsedData)
    .filter(([, values]) => values.length === 0)
    .map(([section]) => section.charAt(0).toUpperCase() + section.slice(1));

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={<DocumentStatus state={saveState} status={status} />}
        description="Turn your CV into editable, searchable evidence for fit analysis and grounded preparation."
        eyebrow="CV intelligence"
        icon={FileText}
        title="Evidence extraction workspace"
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[48%] opacity-45" compact />
        <div className="relative grid lg:grid-cols-[1fr_420px]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#2BC3CE]">
              <ScanSearch className="h-3.5 w-3.5" />
              Active document
            </div>
            <h2 className="mt-4 truncate text-2xl font-bold">{resume?.filename ?? "No CV uploaded yet"}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/[0.55]">
              {resume ? `${resume.chunk_count} searchable chunks are available to role analysis and interview RAG.` : "Upload a PDF or DOCX to create your first evidence index."}
            </p>
          </div>
          <div className="border-t border-white/[0.10] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-white/[0.45]">Section coverage</p>
                <p className="mt-2 text-4xl font-bold">{resume ? `${populatedSectionCount}/4` : "0/4"}</p>
              </div>
              <span className="text-xs font-semibold text-white/[0.48]">Education / Experience / Skills / Projects</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.10]">
              <MotionBar className={populatedSectionCount === 4 ? "bg-[#2BC3CE]" : "bg-[#FF5A4E]"} value={populatedSectionCount * 25} />
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-6">
          <Reveal className="app-surface p-5 sm:p-6" delay={0.04}>
            <SectionHeading
              action={resume ? <span className="data-chip max-w-[220px] truncate"><FileCheck2 className="mr-1.5 h-3.5 w-3.5 text-[#167D87]" />{resume.filename}</span> : undefined}
              description="Replace the current document at any time. Accepted files are parsed immediately."
              title="Upload source CV"
            />

            <label
              className={cn(
                "group relative mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed px-6 text-center transition",
                isDragging
                  ? "border-[#FF5A4E] bg-[#fff3f2]"
                  : "border-[#b7bdc5] bg-[#f8f9fa] hover:border-[#FF5A4E] hover:bg-[#fff8f7]",
              )}
              htmlFor="resume-file"
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              {saveState === "uploading" && !reduceMotion ? (
                <motion.span
                  animate={{ y: [0, 180, 0] }}
                  className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[#FF5A4E] shadow-[0_0_18px_rgba(255,90,78,0.65)]"
                  transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
                />
              ) : null}
              <span className={cn("grid h-12 w-12 place-items-center rounded-md border bg-white shadow-sm transition group-hover:-translate-y-0.5", isDragging ? "border-[#FF5A4E] text-[#D9473F]" : "border-border text-foreground")}>
                {saveState === "uploading" ? <ScanSearch className="h-5 w-5 animate-pulse" /> : <UploadCloud className="h-5 w-5" />}
              </span>
              <span className="mt-4 text-base font-bold text-foreground">{saveState === "uploading" ? "Extracting four evidence sections" : "Drop a PDF or DOCX here"}</span>
              <span className="mt-1 text-sm text-muted-foreground">{saveState === "uploading" ? "Text, structure, and embeddings are being prepared." : "Choose a file from your computer, up to 10 MB."}</span>
              <div className="mt-4 flex gap-2"><span className="data-chip">PDF</span><span className="data-chip">DOCX</span></div>
              <input accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" id="resume-file" onChange={(event) => void uploadResume(event.target.files?.[0] ?? null)} type="file" />
            </label>
            <AnimatePresence initial={false}>
              {errorMessage ? (
                <motion.div animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-start gap-2 rounded-md border border-[#f0b5b0] bg-[#fff3f2] p-3 text-sm font-semibold text-[#A63832]" exit={{ opacity: 0, y: -4 }} initial={{ opacity: 0, y: -4 }} role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {errorMessage}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Reveal>

          {resume ? (
            <Reveal className="app-surface overflow-hidden" delay={0.08}>
              <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div>
                  <h2 className="text-base font-bold text-foreground">Review extracted evidence</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Every section is editable. Use one item per line for cleaner retrieval.</p>
                  {missingSectionLabels.length ? <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#A63832]"><AlertTriangle className="h-4 w-4" />Review needed: {missingSectionLabels.join(", ")}.</p> : <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#167D87]"><Check className="h-4 w-4" />All four sections contain evidence.</p>}
                </div>
                <Button disabled={saveState === "saving"} onClick={() => void saveCorrections()} type="button">
                  <Save className="h-4 w-4" />
                  {saveState === "saving" ? "Saving" : "Save corrections"}
                </Button>
              </div>

              <div className="grid md:grid-cols-2">
                <ParsedSection icon={GraduationCap} label="Education" onChange={(value) => setParsedData((current) => ({ ...current, education: linesToList(value) }))} value={listToLines(parsedData.education)} />
                <ParsedSection icon={Sparkles} label="Experience" onChange={(value) => setParsedData((current) => ({ ...current, experience: linesToList(value) }))} value={listToLines(parsedData.experience)} />
                <ParsedSection icon={Wrench} label="Skills" onChange={(value) => setParsedData((current) => ({ ...current, skills: linesToList(value) }))} value={listToLines(parsedData.skills)} />
                <ParsedSection icon={Braces} label="Projects" onChange={(value) => setParsedData((current) => ({ ...current, projects: linesToList(value) }))} value={listToLines(parsedData.projects)} />
              </div>
            </Reveal>
          ) : null}
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Reveal className="app-surface overflow-hidden" delay={0.06}>
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><ListChecks className="h-4 w-4" />Extraction pipeline</div>
            </div>
            <ol className="divide-y divide-border">
              <PipelineStep complete={Boolean(resume)} index="01" label="Source text extracted" />
              <PipelineStep complete={Boolean(resume)} index="02" label="Four sections structured" />
              <PipelineStep complete={Boolean(resume?.chunk_count)} index="03" label="Chunks embedded" />
              <PipelineStep complete={Boolean(resume) && !missingSectionLabels.length} index="04" label="Evidence reviewed" />
            </ol>
          </Reveal>

          <Reveal className="overflow-hidden rounded-lg border border-[#272c33] bg-[#101318] text-white" delay={0.1}>
            <div className="border-b border-white/[0.10] px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#2BC3CE]"><Layers3 className="h-4 w-4" />Document signals</div>
            </div>
            <dl className="divide-y divide-white/[0.10] text-sm">
              <SummaryItem label="File" value={resume ? "Stored" : "Not uploaded"} />
              <SummaryItem label="Sections" value={resume ? `${populatedSectionCount}/4 populated` : "0/4 populated"} />
              <SummaryItem label="Indexed chunks" value={resume?.chunk_count.toString() ?? "0"} />
              <SummaryItem label="Review state" value={resume && !missingSectionLabels.length ? "Complete" : "Waiting"} />
            </dl>
          </Reveal>

          {resume ? (
            <Reveal delay={0.14}>
              <details className="app-surface group overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-foreground">
                  Source text
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap border-t border-border bg-[#f8f9fa] p-5 text-xs leading-5 text-muted-foreground">{resume.content_text}</pre>
              </details>
            </Reveal>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ParsedSection({
  icon: Icon,
  label,
  onChange,
  value,
}: Readonly<{
  label: string;
  icon: typeof GraduationCap;
  onChange: (value: string) => void;
  value: string;
}>) {
  return (
    <section className="border-b border-border p-5 even:border-l md:p-6 [&:nth-last-child(-n+2)]:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#D9473F]" />{label}</Label>
        <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold uppercase", value ? "bg-[#e8f8f9] text-[#167D87]" : "bg-[#fff3f2] text-[#A63832]")}>{value ? `${linesToList(value).length} items` : "Missing"}</span>
      </div>
      <Textarea className="mt-3 min-h-44 resize-y bg-[#fbfbfc]" onChange={(event) => onChange(event.target.value)} placeholder={`Add ${label.toLowerCase()} evidence, one item per line`} value={value} />
    </section>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <dt className="text-white/[0.45]">{label}</dt>
      <dd className="text-right font-bold text-white">{value}</dd>
    </div>
  );
}

function DocumentStatus({ state, status }: Readonly<{ state: SaveState; status: string }>) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", state === "error" ? "bg-[#FF5A4E]" : state === "uploading" || state === "saving" ? "animate-pulse bg-[#F0A13A]" : "bg-[#2BC3CE]")} />
      {status}
    </div>
  );
}

function PipelineStep({ complete, index, label }: Readonly<{ complete: boolean; index: string; label: string }>) {
  return (
    <li className="grid grid-cols-[30px_1fr_auto] items-center gap-3 px-5 py-3.5">
      <span className="text-[10px] font-bold text-muted-foreground">{index}</span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className={cn("grid h-5 w-5 place-items-center rounded-full", complete ? "bg-[#2BC3CE] text-white" : "border border-border bg-[#f7f8f9] text-transparent")}><Check className="h-3 w-3" /></span>
    </li>
  );
}
