"use client";

import type { DragEvent } from "react";
import { useState } from "react";
import { z } from "zod";

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
    <div className="space-y-6">
      <header className="overflow-hidden rounded-lg border border-[#1d4b42] bg-[#10221f] text-white shadow-[0_14px_32px_rgba(15,38,33,0.18)]">
        <div className="grid gap-7 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#a9c1ba]">CV library</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Make your strongest evidence searchable.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c5d8d2]">
              Upload a CV, review the extracted evidence, and keep the profile behind each application current.
            </p>
          </div>
          <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a9c1ba]">Document status</p>
            <p className="mt-2 text-xl font-semibold">{status}</p>
            <p className="mt-2 text-sm text-[#c5d8d2]">
              {resume ? `${resume.chunk_count} indexed chunks` : "PDF and DOCX supported"}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-6">
          <section className="app-surface p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Upload a CV</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Replace the current file at any time. Your extracted profile stays editable.</p>
              </div>
              {resume ? <span className="data-chip">{resume.filename}</span> : null}
            </div>

            <label
              className={cn(
                "mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center transition",
                isDragging
                  ? "border-primary bg-[#edf8f4]"
                  : "border-[#9bc8bb] bg-[#f8fcfa] hover:border-primary hover:bg-[#f1faf6]",
              )}
              htmlFor="resume-file"
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <span className="grid h-10 w-10 place-items-center rounded-md bg-[#d7f75b] text-sm font-bold text-[#10221f]">CV</span>
              <span className="mt-4 text-base font-semibold text-foreground">Drop a PDF or DOCX here</span>
              <span className="mt-1 text-sm text-muted-foreground">or choose a file from your computer</span>
              <input
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                id="resume-file"
                onChange={(event) => void uploadResume(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            {errorMessage ? <p className="mt-4 text-sm font-medium text-[#a34c47]">{errorMessage}</p> : null}
          </section>

          {resume ? (
            <section className="app-surface p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Review extracted evidence</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Edit anything the parser missed before using it in fit analyses.</p>
                  {missingSectionLabels.length ? (
                    <p className="mt-2 text-sm font-medium text-[#9b554f]">
                      Review needed: {missingSectionLabels.join(", ")}.
                    </p>
                  ) : null}
                </div>
                <Button disabled={saveState === "saving"} onClick={() => void saveCorrections()} type="button">
                  {saveState === "saving" ? "Saving" : "Save corrections"}
                </Button>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <ParsedSection
                  label="Education"
                  onChange={(value) => setParsedData((current) => ({ ...current, education: linesToList(value) }))}
                  value={listToLines(parsedData.education)}
                />
                <ParsedSection
                  label="Experience"
                  onChange={(value) => setParsedData((current) => ({ ...current, experience: linesToList(value) }))}
                  value={listToLines(parsedData.experience)}
                />
                <ParsedSection
                  label="Skills"
                  onChange={(value) => setParsedData((current) => ({ ...current, skills: linesToList(value) }))}
                  value={listToLines(parsedData.skills)}
                />
                <ParsedSection
                  label="Projects"
                  onChange={(value) => setParsedData((current) => ({ ...current, projects: linesToList(value) }))}
                  value={listToLines(parsedData.projects)}
                />
              </div>
            </section>
          ) : null}
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="app-surface p-5 sm:p-6">
            <p className="text-base font-semibold text-foreground">CV signals</p>
            <dl className="mt-5 space-y-4 text-sm">
              <SummaryItem label="File" value={resume ? "Stored" : "Not uploaded"} />
              <SummaryItem label="Sections" value={resume ? `${populatedSectionCount}/4 populated` : "-"} />
              <SummaryItem label="Indexed chunks" value={resume?.chunk_count.toString() ?? "0"} />
              <SummaryItem label="Review state" value={resume ? "Ready" : "Waiting"} />
            </dl>
          </section>

          {resume ? (
            <details className="app-surface group p-5 sm:p-6">
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                Source text
              </summary>
              <pre className="mt-4 max-h-[460px] overflow-auto whitespace-pre-wrap border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                {resume.content_text}
              </pre>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ParsedSection({
  label,
  onChange,
  value,
}: Readonly<{
  label: string;
  onChange: (value: string) => void;
  value: string;
}>) {
  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0 md:odd:border-t-0 md:odd:pt-0">
      <Label>{label}</Label>
      <Textarea className="mt-2 min-h-40" onChange={(event) => onChange(event.target.value)} value={value} />
    </section>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}
