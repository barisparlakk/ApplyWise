"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileSnapshot } from "@/lib/api";
import { JSON_HEADERS } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const languageSchema = z.object({
  name: z.string().trim().max(80),
  level: z.string().trim().max(80),
});

const projectSchema = z.object({
  name: z.string().trim().max(255),
  description: z.string().trim().nullable(),
  url: z.string().trim().max(2048).nullable(),
  skills: z.array(z.string().trim().min(1)).default([]),
});

const profileBuilderSchema = z.object({
  education: z.string().trim().max(120).nullable(),
  github_url: z.string().trim().max(2048).nullable(),
  target_roles: z.array(z.string().trim().min(1)),
  preferred_location: z.string().trim().max(255).nullable(),
  internship_type: z.string().trim().max(120).nullable(),
  languages: z.array(languageSchema),
  experience_level: z.string().trim().max(120).nullable(),
  skills: z.array(z.string().trim().min(1)),
  projects: z.array(projectSchema),
});

type ProfileBuilderState = z.infer<typeof profileBuilderSchema>;
type SaveState = "idle" | "saving" | "saved" | "invalid" | "error";

type ProfileBuilderProps = {
  apiBaseUrl: string;
  initialSnapshot: ProfileSnapshot;
};

const internshipTypes = ["Full-time", "Part-time", "Remote", "Hybrid", "On-site"];
const experienceLevels = [
  "No professional experience",
  "Coursework only",
  "Project experience",
  "Prior internship",
  "Freelance or part-time experience",
];
const languageLevels = ["Native", "C2", "C1", "B2", "B1", "A2", "A1"];

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function splitTags(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function snapshotToState(snapshot: ProfileSnapshot): ProfileBuilderState {
  return {
    education: snapshot.profile.education,
    github_url: snapshot.profile.github_url,
    target_roles: snapshot.profile.target_roles,
    preferred_location: snapshot.profile.preferred_location,
    internship_type: snapshot.profile.internship_type,
    languages: snapshot.profile.languages,
    experience_level: snapshot.profile.experience_level,
    skills: snapshot.profile.skills,
    projects: snapshot.projects.map((project) => ({
      name: project.name,
      description: project.description,
      url: project.url,
      skills: project.skills,
    })),
  };
}

function getReadiness(form: ProfileBuilderState) {
  const checks = [
    Boolean(form.education),
    Boolean(form.github_url),
    Boolean(form.experience_level),
    Boolean(form.internship_type),
    form.target_roles.length > 0,
    form.skills.length > 0,
    form.languages.some((language) => language.name && language.level),
    form.projects.some(
      (project) => Boolean(project.name) && Boolean(project.description) && project.skills.length > 0,
    ),
  ];
  const completed = checks.filter(Boolean).length;

  return {
    completed,
    total: checks.length,
    percentage: Math.round((completed / checks.length) * 100),
  };
}

function getRoleTheme(role: string) {
  if (role.includes("Data") || role.includes("Analyst")) {
    return "Data and analytics";
  }
  if (role.includes("AI") || role.includes("Image")) {
    return "AI and applied ML";
  }
  if (role.includes("Backend")) {
    return "Systems and APIs";
  }
  return "Software delivery";
}

export function ProfileBuilder({
  apiBaseUrl,
  initialSnapshot,
}: ProfileBuilderProps) {
  const [form, setForm] = useState<ProfileBuilderState>(() => snapshotToState(initialSnapshot));
  const [skillInput, setSkillInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasMounted = useRef(false);
  const saveRequest = useRef(0);
  const readiness = getReadiness(form);

  const persistProfile = useCallback(async (payload: ProfileBuilderState) => {
    const requestId = ++saveRequest.current;
    setSaveState("saving");
    setSaveError(null);

    try {
      const responses = await Promise.all([
        fetch(`${apiBaseUrl}/profile`, {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            education: payload.education,
            github_url: payload.github_url,
            target_roles: payload.target_roles,
            preferred_location: payload.preferred_location,
            internship_type: payload.internship_type,
            languages: payload.languages.filter((language) => language.name && language.level),
            experience_level: payload.experience_level,
          }),
        }),
        fetch(`${apiBaseUrl}/profile/skills`, {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({ skills: payload.skills }),
        }),
        fetch(`${apiBaseUrl}/profile/projects`, {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({ projects: payload.projects.filter((project) => project.name) }),
        }),
      ]);

      if (responses.some((response) => !response.ok)) {
        throw new Error("The profile could not be saved.");
      }

      if (requestId === saveRequest.current) {
        setSaveState("saved");
      }
    } catch (error) {
      if (requestId === saveRequest.current) {
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "The profile could not be saved.");
      }
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const parsed = profileBuilderSchema.safeParse(form);
    if (!parsed.success) {
      setSaveState("invalid");
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistProfile(parsed.data);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [form, persistProfile]);

  function updateField<Key extends keyof ProfileBuilderState>(
    key: Key,
    value: ProfileBuilderState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: string) {
    updateField(
      "target_roles",
      form.target_roles.includes(role)
        ? form.target_roles.filter((item) => item !== role)
        : [...form.target_roles, role],
    );
  }

  function addSkill() {
    const tags = splitTags(skillInput);
    if (!tags.length) {
      return;
    }
    updateField("skills", splitTags([...form.skills, ...tags].join(",")));
    setSkillInput("");
  }

  function retrySave() {
    const parsed = profileBuilderSchema.safeParse(form);
    if (!parsed.success) {
      setSaveState("invalid");
      return;
    }
    void persistProfile(parsed.data);
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-lg border border-[#1d4b42] bg-[#10221f] text-white shadow-[0_14px_32px_rgba(15,38,33,0.18)]">
        <div className="grid gap-7 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#a9c1ba]">Profile workspace</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Build a profile recruiters can understand.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c5d8d2]">
              Keep your strongest evidence current for every role you analyze.
            </p>
            <SaveIndicator onRetry={retrySave} state={saveState} />
          </div>
          <div className="border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a9c1ba]">Profile readiness</p>
                <p className="mt-2 text-4xl font-semibold">{readiness.percentage}%</p>
              </div>
              <p className="pb-1 text-sm text-[#c5d8d2]">
                {readiness.completed} of {readiness.total} signals
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-[#d7f75b] transition-[width] duration-500 ease-out"
                style={{ width: `${readiness.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label="Profile sections"
        className="flex gap-1 overflow-x-auto border-b border-border pb-3"
      >
        <a className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground" href="#essentials">
          Essentials
        </a>
        <a className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground" href="#roles">
          Target roles
        </a>
        <a className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground" href="#evidence">
          Skills and projects
        </a>
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-6">
          <section className="app-surface p-5 sm:p-6" id="essentials">
            <SectionHeading
              description="The context behind your availability and experience."
              title="Career essentials"
            />
            <div className="mt-6 grid gap-x-5 gap-y-5 md:grid-cols-2">
              <Field label="Education">
                <Input
                  onChange={(event) => updateField("education", emptyToNull(event.target.value))}
                  placeholder="Computer Engineering, 3rd year"
                  value={form.education ?? ""}
                />
              </Field>
              <Field label="GitHub URL">
                <Input
                  onChange={(event) => updateField("github_url", emptyToNull(event.target.value))}
                  placeholder="https://github.com/username"
                  type="url"
                  value={form.github_url ?? ""}
                />
              </Field>
              <Field label="Preferred location">
                <Input
                  onChange={(event) => updateField("preferred_location", emptyToNull(event.target.value))}
                  placeholder="Remote, Istanbul, Berlin"
                  value={form.preferred_location ?? ""}
                />
              </Field>
              <Field label="Internship type">
                <Select
                  onChange={(event) => updateField("internship_type", emptyToNull(event.target.value))}
                  value={form.internship_type ?? ""}
                >
                  <option value="">Select type</option>
                  {internshipTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field className="md:col-span-2" label="Experience level">
                <Select
                  onChange={(event) => updateField("experience_level", emptyToNull(event.target.value))}
                  value={form.experience_level ?? ""}
                >
                  <option value="">Select experience level</option>
                  {experienceLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <section className="app-surface p-5 sm:p-6" id="roles">
            <SectionHeading
              description="Select the roles your profile should be evaluated against."
              title="Target roles"
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {initialSnapshot.target_role_options.map((role) => {
                const selected = form.target_roles.includes(role);
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "motion-control flex min-h-[76px] items-start justify-between rounded-lg border p-4 text-left",
                      selected
                        ? "border-[#6bb7a4] bg-[#eff9f6] shadow-sm"
                        : "border-border bg-white hover:border-[#98c8ba] hover:bg-[#fbfdfc]",
                    )}
                    key={role}
                    onClick={() => toggleRole(role)}
                    type="button"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{role}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{getRoleTheme(role)}</span>
                    </span>
                    <span
                      className={cn(
                        "ml-3 inline-flex shrink-0 rounded-md px-2 py-1 text-xs font-semibold",
                        selected ? "bg-[#d7f75b] text-[#10221f]" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {selected ? "Focused" : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="app-surface p-5 sm:p-6" id="evidence">
            <SectionHeading
              action={
                <Button
                  onClick={() =>
                    updateField("projects", [
                      ...form.projects,
                      { name: "", description: "", url: "", skills: [] },
                    ])
                  }
                  type="button"
                  variant="secondary"
                >
                  Add project
                </Button>
              }
              description="Use concrete work to make your fit score more representative."
              title="Evidence"
            />

            <div className="mt-6 border-b border-border pb-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Add a skill, for example Python or FastAPI"
                  value={skillInput}
                />
                <Button className="shrink-0" onClick={addSkill} type="button">
                  Add skill
                </Button>
              </div>
              <div className="mt-4 flex min-h-8 flex-wrap gap-2">
                {form.skills.length ? (
                  form.skills.map((skill) => (
                    <button
                      aria-label={`Remove ${skill}`}
                      className="motion-control inline-flex items-center gap-2 rounded-md border border-[#c9e1d9] bg-[#f0f8f5] px-2.5 py-1.5 text-sm font-medium text-[#205f51] hover:border-[#8fc6b7] hover:bg-[#e2f3ed]"
                      key={skill}
                      onClick={() => updateField("skills", form.skills.filter((item) => item !== skill))}
                      title={`Remove ${skill}`}
                      type="button"
                    >
                      {skill}
                      <span aria-hidden="true" className="text-xs font-bold">x</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No skills added yet.</p>
                )}
              </div>
            </div>

            <div className="divide-y divide-border">
              {form.projects.length ? (
                form.projects.map((project, index) => (
                  <article className="py-6 first:pt-6" key={`${project.name}-${index}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-7 w-7 place-items-center rounded-md bg-[#e6f2ee] text-xs font-bold text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-base font-semibold text-foreground">
                          {project.name || "New project"}
                        </h3>
                      </div>
                      <button
                        className="motion-control text-sm font-semibold text-[#a34c47] hover:text-[#7f302c]"
                        onClick={() =>
                          updateField(
                            "projects",
                            form.projects.filter((_, projectIndex) => projectIndex !== index),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-5 grid gap-x-5 gap-y-4 md:grid-cols-2">
                      <Field label="Project name">
                        <Input
                          onChange={(event) => {
                            const projects = [...form.projects];
                            projects[index] = { ...project, name: event.target.value };
                            updateField("projects", projects);
                          }}
                          placeholder="RAG assistant"
                          value={project.name}
                        />
                      </Field>
                      <Field label="Project URL">
                        <Input
                          onChange={(event) => {
                            const projects = [...form.projects];
                            projects[index] = { ...project, url: emptyToNull(event.target.value) };
                            updateField("projects", projects);
                          }}
                          placeholder="https://github.com/username/project"
                          value={project.url ?? ""}
                        />
                      </Field>
                      <Field className="md:col-span-2" label="What did you build?">
                        <Textarea
                          className="min-h-28"
                          onChange={(event) => {
                            const projects = [...form.projects];
                            projects[index] = {
                              ...project,
                              description: emptyToNull(event.target.value),
                            };
                            updateField("projects", projects);
                          }}
                          placeholder="Describe the problem, your contribution, and outcome."
                          value={project.description ?? ""}
                        />
                      </Field>
                      <Field className="md:col-span-2" label="Project skills">
                        <Input
                          onChange={(event) => {
                            const projects = [...form.projects];
                            projects[index] = { ...project, skills: splitTags(event.target.value) };
                            updateField("projects", projects);
                          }}
                          placeholder="Python, FastAPI, PostgreSQL"
                          value={project.skills.join(", ")}
                        />
                      </Field>
                    </div>
                  </article>
                ))
              ) : (
                <div className="py-8 text-sm text-muted-foreground">
                  Add a project to strengthen your profile evidence.
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="app-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-foreground">Languages</p>
                <p className="mt-1 text-sm text-muted-foreground">Add the languages you can interview in.</p>
              </div>
              <Button
                onClick={() => updateField("languages", [...form.languages, { name: "", level: "B2" }])}
                type="button"
                variant="secondary"
              >
                Add
              </Button>
            </div>
            <div className="mt-5 space-y-3">
              {form.languages.length ? (
                form.languages.map((language, index) => (
                  <div className="grid grid-cols-[minmax(0,1fr)_84px_auto] gap-2" key={`${language.name}-${index}`}>
                    <Input
                      aria-label={`Language ${index + 1}`}
                      onChange={(event) => {
                        const languages = [...form.languages];
                        languages[index] = { ...language, name: event.target.value };
                        updateField("languages", languages);
                      }}
                      placeholder="English"
                      value={language.name}
                    />
                    <Select
                      aria-label={`Language ${index + 1} level`}
                      onChange={(event) => {
                        const languages = [...form.languages];
                        languages[index] = { ...language, level: event.target.value };
                        updateField("languages", languages);
                      }}
                      value={language.level}
                    >
                      {languageLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </Select>
                    <button
                      aria-label={`Remove ${language.name || "language"}`}
                      className="motion-control grid h-10 w-10 place-items-center rounded-md border border-border text-sm font-semibold text-muted-foreground hover:border-[#e6aaa5] hover:bg-[#fff4f3] hover:text-[#a34c47]"
                      disabled={form.languages.length === 1}
                      onClick={() => updateField("languages", form.languages.filter((_, itemIndex) => itemIndex !== index))}
                      title="Remove language"
                      type="button"
                    >
                      x
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No languages added.</p>
              )}
            </div>
          </section>

          <section className="app-surface p-5 sm:p-6">
            <p className="text-base font-semibold text-foreground">Profile signals</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
              <Signal label="Roles" value={form.target_roles.length.toString()} />
              <Signal label="Skills" value={form.skills.length.toString()} />
              <Signal label="Projects" value={form.projects.filter((project) => project.name).length.toString()} />
              <Signal label="Languages" value={form.languages.filter((language) => language.name).length.toString()} />
            </dl>
          </section>

          <section className="border-l-2 border-[#d7f75b] bg-[#eff8f5] px-4 py-4">
            <p className="text-sm font-semibold text-[#174e43]">Continue building</p>
            <div className="mt-3 grid gap-2">
              <Link className="text-sm font-semibold text-primary hover:underline" href="/resume">Review CV</Link>
              <Link className="text-sm font-semibold text-primary hover:underline" href="/projects">Analyze projects</Link>
            </div>
          </section>
        </aside>
      </div>
      {saveError ? <p className="sr-only" role="alert">{saveError}</p> : null}
    </div>
  );
}

function SaveIndicator({
  onRetry,
  state,
}: Readonly<{
  onRetry: () => void;
  state: SaveState;
}>) {
  const copy = {
    idle: "Changes save automatically",
    saving: "Saving changes",
    saved: "All changes saved",
    invalid: "Review incomplete fields",
    error: "Could not save changes",
  }[state];

  const dot = {
    idle: "bg-[#a9c1ba]",
    saving: "bg-[#d7f75b] animate-pulse",
    saved: "bg-[#d7f75b]",
    invalid: "bg-[#f0a13a]",
    error: "bg-[#ef8b86]",
  }[state];

  return (
    <div aria-live="polite" className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[#c5d8d2]">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span>{copy}</span>
      {state === "error" ? (
        <button className="motion-control rounded-md border border-white/20 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/10" onClick={onRetry} type="button">
          Retry save
        </button>
      ) : null}
    </div>
  );
}

function SectionHeading({
  action,
  description,
  title,
}: Readonly<{
  action?: React.ReactNode;
  description: string;
  title: string;
}>) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Field({
  children,
  className,
  label,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  label: string;
}>) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Signal({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-foreground">{value}</dd>
    </div>
  );
}
