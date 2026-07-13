"use client";

import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  FilePlus2,
  Files,
  LoaderCircle,
  Save,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Reveal } from "@/components/motion";
import { useTranslations } from "@/components/locale-provider";
import { SectionHeading } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedResumeData, ResumeVersionData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export const RESUME_VERSION_TARGET_ROLES = [
  "AI Intern",
  "Data Science Intern",
  "Backend Intern",
  "Image Processing Intern",
  "Business Analyst Intern",
] as const;

const versionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  target_role: z.enum(RESUME_VERSION_TARGET_ROLES),
  parsed_data: z.object({
    education: z.array(z.string().trim().min(1)).max(100),
    experience: z.array(z.string().trim().min(1)).max(100),
    skills: z.array(z.string().trim().min(1)).max(100),
    projects: z.array(z.string().trim().min(1)).max(100),
  }),
});

type Draft = z.infer<typeof versionSchema> & { id: string };
type RequestState = "idle" | "creating" | "saving" | "deleting";

type ResumeVersionLibraryProps = {
  apiBaseUrl: string;
  initialVersions: ResumeVersionData[];
  sourceResumeId: string | null;
};

export function ResumeVersionLibrary({
  apiBaseUrl,
  initialVersions,
  sourceResumeId,
}: ResumeVersionLibraryProps) {
  const t = useTranslations();
  const [versions, setVersions] = useState(initialVersions);
  const [selectedId, setSelectedId] = useState(initialVersions[0]?.id ?? null);
  const [draft, setDraft] = useState<Draft | null>(
    initialVersions[0] ? draftFromVersion(initialVersions[0]) : null,
  );
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<(typeof RESUME_VERSION_TARGET_ROLES)[number]>(
    "Backend Intern",
  );
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedId) ?? null,
    [selectedId, versions],
  );

  function selectVersion(version: ResumeVersionData) {
    setSelectedId(version.id);
    setDraft(draftFromVersion(version));
    setMessage(null);
  }

  async function createVersion() {
    if (!sourceResumeId || !newName.trim()) {
      setMessage({
        tone: "error",
        text: t(sourceResumeId ? "Name this CV version." : "Upload a source CV first."),
      });
      return;
    }
    try {
      setRequestState("creating");
      setMessage(null);
      const response = await fetch(`${apiBaseUrl}/resume/versions`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          source_resume_id: sourceResumeId,
          name: newName.trim(),
          target_role: newRole,
        }),
      });
      if (!response.ok) {
        throw await apiError(response, t("CV version could not be created."));
      }
      const created = (await response.json()) as ResumeVersionData;
      setVersions((current) => [created, ...current]);
      selectVersion(created);
      setNewName("");
      setMessage({ tone: "success", text: t("CV version created.") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? t(error.message) : t("CV version could not be created."),
      });
    } finally {
      setRequestState("idle");
    }
  }

  async function saveVersion() {
    const parsed = versionSchema.safeParse(draft);
    if (!draft || !parsed.success) {
      setMessage({ tone: "error", text: t("Complete the CV version fields before saving.") });
      return;
    }
    try {
      setRequestState("saving");
      setMessage(null);
      const response = await fetch(`${apiBaseUrl}/resume/versions/${draft.id}`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        throw await apiError(response, t("CV version could not be saved."));
      }
      const updated = (await response.json()) as ResumeVersionData;
      setVersions((current) =>
        current.map((version) => (version.id === updated.id ? updated : version)),
      );
      setDraft(draftFromVersion(updated));
      setMessage({ tone: "success", text: t("CV version saved.") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? t(error.message) : t("CV version could not be saved."),
      });
    } finally {
      setRequestState("idle");
    }
  }

  async function deleteVersion() {
    if (!selectedVersion || !window.confirm(t("Delete this CV version?"))) {
      return;
    }
    try {
      setRequestState("deleting");
      setMessage(null);
      const response = await fetch(`${apiBaseUrl}/resume/versions/${selectedVersion.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw await apiError(response, t("CV version could not be deleted."));
      }
      const remaining = versions.filter((version) => version.id !== selectedVersion.id);
      setVersions(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setDraft(remaining[0] ? draftFromVersion(remaining[0]) : null);
      setMessage({ tone: "success", text: t("CV version deleted.") });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? t(error.message) : t("CV version could not be deleted."),
      });
    } finally {
      setRequestState("idle");
    }
  }

  return (
    <Reveal className="app-surface overflow-hidden" delay={0.16}>
      <div className="border-b border-border p-5 sm:p-6">
        <SectionHeading
          description={t("Maintain focused evidence for each internship track and select it per application.")}
          title={t("Role-specific CV library")}
        />
      </div>

      <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-[#f8f9fa] lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-border p-5">
            <Label htmlFor="version-name">{t("New CV version")}</Label>
            <Input
              id="version-name"
              maxLength={255}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t("Backend CV - concise")}
              value={newName}
            />
            <Select
              onChange={(event) =>
                setNewRole(event.target.value as (typeof RESUME_VERSION_TARGET_ROLES)[number])
              }
              value={newRole}
            >
              {RESUME_VERSION_TARGET_ROLES.map((role) => (
                <option key={role} value={role}>{t(role)}</option>
              ))}
            </Select>
            <Button
              className="w-full"
              disabled={requestState !== "idle" || !sourceResumeId}
              onClick={() => void createVersion()}
              type="button"
            >
              {requestState === "creating" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {t("Create from active CV")}
            </Button>
          </div>

          <div className="divide-y divide-border">
            {versions.map((version) => (
              <button
                aria-pressed={selectedId === version.id}
                className={cn(
                  "flex w-full items-start gap-3 px-5 py-4 text-left transition",
                  selectedId === version.id ? "bg-white" : "hover:bg-white/70",
                )}
                key={version.id}
                onClick={() => selectVersion(version)}
                type="button"
              >
                <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border", selectedId === version.id ? "border-[#FF5A4E] bg-[#fff3f2] text-[#D9473F]" : "border-border bg-white text-muted-foreground")}>
                  <Files className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">{version.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{t(version.target_role)}</span>
                  <span className="mt-1 block text-[10px] font-bold uppercase text-[#167D87]">{t("{count} applications", { count: version.selected_application_count })}</span>
                </span>
              </button>
            ))}
            {!versions.length ? (
              <div className="px-5 py-10 text-center">
                <Files className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold text-foreground">{t("No CV versions yet")}</p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0">
          {draft ? (
            <>
              <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="active-version-name">{t("Version name")}</Label>
                    <Input
                      className="mt-2"
                      id="active-version-name"
                      onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)}
                      value={draft.name}
                    />
                  </div>
                  <div>
                    <Label htmlFor="active-version-role">{t("Target role")}</Label>
                    <Select
                      className="mt-2"
                      id="active-version-role"
                      onChange={(event) => setDraft((current) => current ? { ...current, target_role: event.target.value as Draft["target_role"] } : current)}
                      value={draft.target_role}
                    >
                      {RESUME_VERSION_TARGET_ROLES.map((role) => <option key={role} value={role}>{t(role)}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    aria-label={t("Delete CV version")}
                    disabled={requestState !== "idle"}
                    onClick={() => void deleteVersion()}
                    title={t("Delete CV version")}
                    type="button"
                    variant="secondary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button disabled={requestState !== "idle"} onClick={() => void saveVersion()} type="button">
                    {requestState === "saving" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {t("Save version")}
                  </Button>
                </div>
              </div>
              <div className="grid md:grid-cols-2">
                {(Object.keys(draft.parsed_data) as Array<keyof ParsedResumeData>).map((section) => (
                  <div className="border-b border-border p-5 even:border-l md:p-6 [&:nth-last-child(-n+2)]:border-b-0" key={section}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
                      <BriefcaseBusiness className="h-4 w-4 text-[#D9473F]" />
                      {t(section.charAt(0).toUpperCase() + section.slice(1))}
                    </div>
                    <Textarea
                      className="mt-3 min-h-40 bg-[#fbfbfc]"
                      onChange={(event) =>
                        setDraft((current) => current ? {
                          ...current,
                          parsed_data: {
                            ...current.parsed_data,
                            [section]: linesToList(event.target.value),
                          },
                        } : current)
                      }
                      value={draft.parsed_data[section].join("\n")}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-[420px] place-items-center p-8 text-center">
              <div>
                <Files className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-bold text-foreground">{t("Select or create a CV version")}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence initial={false}>
        {message ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-2 border-t px-5 py-3 text-sm font-semibold",
              message.tone === "success" ? "border-[#b7e7ea] bg-[#eefafa] text-[#167D87]" : "border-[#f0b5b0] bg-[#fff3f2] text-[#A63832]",
            )}
            exit={{ opacity: 0, y: -3 }}
            initial={{ opacity: 0, y: -3 }}
            role="status"
          >
            {message.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {message.text}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Reveal>
  );
}

function draftFromVersion(version: ResumeVersionData): Draft {
  return {
    id: version.id,
    name: version.name,
    target_role: version.target_role as Draft["target_role"],
    parsed_data: {
      education: [...version.parsed_data.education],
      experience: [...version.parsed_data.experience],
      skills: [...version.parsed_data.skills],
      projects: [...version.parsed_data.projects],
    },
  };
}

function linesToList(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}
