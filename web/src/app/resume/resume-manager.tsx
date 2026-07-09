"use client";

import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedResumeData, ResumeData } from "@/lib/api";

const parsedResumeSchema = z.object({
  education: z.array(z.string().trim().min(1)),
  experience: z.array(z.string().trim().min(1)),
  skills: z.array(z.string().trim().min(1)),
  projects: z.array(z.string().trim().min(1)),
});

type SaveState = "idle" | "uploading" | "saving" | "saved" | "error";

type ResumeManagerProps = {
  apiBaseUrl: string;
  backendToken: string;
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
  backendToken,
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

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    }),
    [backendToken],
  );

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

    try {
      setSaveState("uploading");
      setErrorMessage(null);
      const contentBase64 = await fileToBase64(file);
      const response = await fetch(`${apiBaseUrl}/resume/upload`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filename: file.name,
          content_base64: contentBase64,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}.`);
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
      setErrorMessage("Each parsed section must contain at least one non-empty line.");
      setSaveState("error");
      return;
    }

    try {
      setSaveState("saving");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/resume/${resume.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}.`);
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

  const statusText = {
    idle: "Ready",
    uploading: "Uploading",
    saving: "Saving",
    saved: "Saved",
    error: "Needs attention",
  }[saveState];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="app-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="app-kicker">
                Resume
              </p>
              <h1 className="app-title">CV upload</h1>
            </div>
            <span className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground">
              {statusText}
            </span>
          </div>

          <div className="mt-6">
            <Label htmlFor="resume-file">PDF or DOCX</Label>
            <Input
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="mt-2"
              id="resume-file"
              onChange={(event) => void uploadResume(event.target.files?.[0] ?? null)}
              type="file"
            />
            {errorMessage ? <p className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
          </div>
        </div>

        {resume ? (
          <div className="app-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Parsed result</h2>
                <p className="mt-1 text-sm text-muted-foreground">{resume.filename}</p>
              </div>
              <Button onClick={() => void saveCorrections()} type="button">
                Save corrections
              </Button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ParsedSection
                label="Education"
                onChange={(value) =>
                  setParsedData((current) => ({ ...current, education: linesToList(value) }))
                }
                value={listToLines(parsedData.education)}
              />
              <ParsedSection
                label="Experience"
                onChange={(value) =>
                  setParsedData((current) => ({ ...current, experience: linesToList(value) }))
                }
                value={listToLines(parsedData.experience)}
              />
              <ParsedSection
                label="Skills"
                onChange={(value) =>
                  setParsedData((current) => ({ ...current, skills: linesToList(value) }))
                }
                value={listToLines(parsedData.skills)}
              />
              <ParsedSection
                label="Projects"
                onChange={(value) =>
                  setParsedData((current) => ({ ...current, projects: linesToList(value) }))
                }
                value={listToLines(parsedData.projects)}
              />
            </div>
          </div>
        ) : (
          <div className="app-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">No CV uploaded yet</h2>
          </div>
        )}
      </section>

      <aside className="space-y-6">
        <div className="app-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Storage</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryItem label="Parsed sections" value={resume ? "4" : "0"} />
            <SummaryItem label="Resume chunks" value={resume?.chunk_count.toString() ?? "0"} />
            <SummaryItem label="Embedding" value={resume ? "Created" : "Pending"} />
          </dl>
        </div>

        {resume ? (
          <div className="app-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">Extracted text</h2>
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
              {resume.content_text}
            </pre>
          </div>
        ) : null}
      </aside>
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
    <div>
      <Label>{label}</Label>
      <Textarea className="mt-2 min-h-36" onChange={(event) => onChange(event.target.value)} value={value} />
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
