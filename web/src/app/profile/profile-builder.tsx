"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileSnapshot } from "@/lib/api";

const languageSchema = z.object({
  name: z.string().trim().max(80),
  level: z.string().trim().max(80),
});

const projectSchema = z.object({
  name: z.string().trim().min(1).max(255),
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
  backendToken: string;
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

export function ProfileBuilder({
  apiBaseUrl,
  backendToken,
  initialSnapshot,
}: ProfileBuilderProps) {
  const [form, setForm] = useState<ProfileBuilderState>(() => snapshotToState(initialSnapshot));
  const [skillInput, setSkillInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hasMounted = useRef(false);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    }),
    [backendToken],
  );

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
      setSaveState("saving");
      const payload = parsed.data;
      Promise.all([
        fetch(`${apiBaseUrl}/profile`, {
          method: "PUT",
          headers,
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
          headers,
          body: JSON.stringify({ skills: payload.skills }),
        }),
        fetch(`${apiBaseUrl}/profile/projects`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ projects: payload.projects }),
        }),
      ])
        .then((responses) => {
          if (responses.some((response) => !response.ok)) {
            throw new Error("Autosave failed.");
          }
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [apiBaseUrl, form, headers]);

  const statusText = {
    idle: "Ready",
    saving: "Saving",
    saved: "Saved",
    invalid: "Check required fields",
    error: "Save failed",
  }[saveState];

  function updateField<Key extends keyof ProfileBuilderState>(
    key: Key,
    value: ProfileBuilderState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addSkill() {
    const tags = splitTags(skillInput);
    if (!tags.length) {
      return;
    }
    setForm((current) => ({
      ...current,
      skills: splitTags([...current.skills, ...tags].join(",")),
    }));
    setSkillInput("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">Profile builder</h1>
            </div>
            <span className="rounded-md border border-border px-3 py-1 text-sm text-muted-foreground">
              {statusText}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                onChange={(event) =>
                  updateField("preferred_location", emptyToNull(event.target.value))
                }
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
            <Field label="Experience level">
              <Select
                onChange={(event) =>
                  updateField("experience_level", emptyToNull(event.target.value))
                }
                value={form.experience_level ?? ""}
              >
                <option value="">Select level</option>
                {experienceLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">Target roles</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {initialSnapshot.target_role_options.map((role) => (
              <label
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                key={role}
              >
                <input
                  checked={form.target_roles.includes(role)}
                  className="h-4 w-4 accent-primary"
                  onChange={(event) => {
                    updateField(
                      "target_roles",
                      event.target.checked
                        ? [...form.target_roles, role]
                        : form.target_roles.filter((item) => item !== role),
                    );
                  }}
                  type="checkbox"
                />
                {role}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>
          <div className="mt-4 flex gap-2">
            <Input
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Python, SQL, FastAPI"
              value={skillInput}
            />
            <Button onClick={addSkill} type="button">
              Add
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {form.skills.map((skill) => (
              <button
                className="rounded-md bg-muted px-3 py-1 text-sm text-foreground"
                key={skill}
                onClick={() =>
                  updateField(
                    "skills",
                    form.skills.filter((item) => item !== skill),
                  )
                }
                type="button"
              >
                {skill} x
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Projects</h2>
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
          </div>
          <div className="mt-4 space-y-4">
            {form.projects.map((project, index) => (
              <div className="rounded-md border border-border p-4" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project name">
                    <Input
                      onChange={(event) => {
                        const projects = [...form.projects];
                        projects[index] = { ...project, name: event.target.value };
                        updateField("projects", projects);
                      }}
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
                      value={project.url ?? ""}
                    />
                  </Field>
                  <Field className="sm:col-span-2" label="Description">
                    <Textarea
                      onChange={(event) => {
                        const projects = [...form.projects];
                        projects[index] = {
                          ...project,
                          description: emptyToNull(event.target.value),
                        };
                        updateField("projects", projects);
                      }}
                      value={project.description ?? ""}
                    />
                  </Field>
                  <Field className="sm:col-span-2" label="Project skills">
                    <Input
                      onChange={(event) => {
                        const projects = [...form.projects];
                        projects[index] = { ...project, skills: splitTags(event.target.value) };
                        updateField("projects", projects);
                      }}
                      placeholder="Python, pandas, PostgreSQL"
                      value={project.skills.join(", ")}
                    />
                  </Field>
                </div>
                <Button
                  className="mt-3"
                  onClick={() =>
                    updateField(
                      "projects",
                      form.projects.filter((_, projectIndex) => projectIndex !== index),
                    )
                  }
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-md border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Languages</h2>
            <Button
              onClick={() =>
                updateField("languages", [...form.languages, { name: "", level: "B2" }])
              }
              type="button"
              variant="secondary"
            >
              Add
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {form.languages.map((language, index) => (
              <div className="grid grid-cols-[1fr_92px] gap-2" key={index}>
                <Input
                  onChange={(event) => {
                    const languages = [...form.languages];
                    languages[index] = { ...language, name: event.target.value };
                    updateField("languages", languages);
                  }}
                  placeholder="English"
                  value={language.name}
                />
                <Select
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
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-lg font-semibold text-foreground">Snapshot</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryItem label="Roles" value={form.target_roles.length.toString()} />
            <SummaryItem label="Skills" value={form.skills.length.toString()} />
            <SummaryItem label="Projects" value={form.projects.length.toString()} />
            <SummaryItem label="Languages" value={form.languages.length.toString()} />
          </dl>
        </div>
      </aside>
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

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
