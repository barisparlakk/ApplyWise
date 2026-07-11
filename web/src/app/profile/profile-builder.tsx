"use client";

import {
  ArrowRight,
  Check,
  CircleCheck,
  GitFork,
  GraduationCap,
  Languages,
  MapPin,
  Plus,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { MotionBar, Reveal } from "@/components/motion";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
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

function getNextSignal(form: ProfileBuilderState) {
  if (!form.education) return { title: "Add your education context", description: "Your field and study level affect education and experience matching." };
  if (!form.target_roles.length) return { title: "Choose at least one target role", description: "Targets let ApplyWise rank evidence and missing skills against a clear direction." };
  if (!form.skills.length) return { title: "Build your skill inventory", description: "Add the tools, languages, methods, and platforms you can use with confidence." };
  if (!form.projects.some((project) => project.name && project.description && project.skills.length)) return { title: "Connect a project to your skills", description: "A named project with outcomes and technologies makes your claims verifiable." };
  if (!form.github_url) return { title: "Connect your GitHub profile", description: "Repository evidence helps validate project depth, testing, and delivery signals." };
  if (!form.languages.some((language) => language.name && language.level)) return { title: "Add an interview language", description: "Language level is part of role fit and interview preparation." };
  return { title: "Your core profile is ready", description: "Keep the evidence current as you complete new projects and target new roles." };
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
  const nextSignal = getNextSignal(form);

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
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <PageHeader
        action={<SaveIndicator onRetry={retrySave} state={saveState} />}
        description="Shape the evidence ApplyWise uses to score roles, find gaps, and ground interview preparation."
        eyebrow="Candidate evidence"
        icon={UserRound}
        title="Build your evidence profile"
      />

      <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
        <SignalField className="left-auto w-[48%] opacity-50" compact />
        <div className="relative grid lg:grid-cols-[1fr_420px]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#FF786D]">
              <Zap className="h-3.5 w-3.5" />
              Next profile signal
            </div>
            <h2 className="mt-4 max-w-xl text-2xl font-bold">{nextSignal.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">{nextSignal.description}</p>
          </div>
          <div className="border-t border-white/10 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-white/45">Evidence readiness</p>
                <p className="mt-2 text-4xl font-bold">{readiness.percentage}%</p>
              </div>
              <p className="text-xs font-semibold text-white/50">{readiness.completed} / {readiness.total} signals</p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <MotionBar className="bg-[#2BC3CE]" value={readiness.percentage} />
            </div>
          </div>
        </div>
      </Reveal>

      <nav aria-label="Profile sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {[
          ["#essentials", "Essentials"],
          ["#roles", "Target roles"],
          ["#evidence", "Skills and projects"],
        ].map(([href, label]) => (
          <a className="motion-control whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-bold text-muted-foreground hover:border-[#FF5A4E] hover:text-foreground" href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-6">
          <Reveal className="app-surface p-5 sm:p-6" id="essentials">
            <SectionHeading description="Context that changes which opportunities fit your constraints and level." title="Career essentials" />
            <div className="mt-6 grid gap-x-5 gap-y-5 md:grid-cols-2">
              <Field icon={GraduationCap} label="Education">
                <Input onChange={(event) => updateField("education", emptyToNull(event.target.value))} placeholder="Computer Engineering, 3rd year" value={form.education ?? ""} />
              </Field>
              <Field icon={GitFork} label="GitHub URL">
                <Input onChange={(event) => updateField("github_url", emptyToNull(event.target.value))} placeholder="https://github.com/username" type="url" value={form.github_url ?? ""} />
              </Field>
              <Field icon={MapPin} label="Preferred location">
                <Input onChange={(event) => updateField("preferred_location", emptyToNull(event.target.value))} placeholder="Remote, Istanbul, Berlin" value={form.preferred_location ?? ""} />
              </Field>
              <Field icon={Target} label="Internship type">
                <Select onChange={(event) => updateField("internship_type", emptyToNull(event.target.value))} value={form.internship_type ?? ""}>
                  <option value="">Select type</option>
                  {internshipTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </Field>
              <Field className="md:col-span-2" icon={Sparkles} label="Experience level">
                <Select onChange={(event) => updateField("experience_level", emptyToNull(event.target.value))} value={form.experience_level ?? ""}>
                  <option value="">Select experience level</option>
                  {experienceLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                </Select>
              </Field>
            </div>
          </Reveal>

          <Reveal className="app-surface overflow-hidden" delay={0.04} id="roles">
            <div className="border-b border-border p-5 sm:p-6">
              <SectionHeading description="Choose every role you want the recommendation engine to optimize for." title="Target roles" />
            </div>
            <div className="divide-y divide-border">
              {initialSnapshot.target_role_options.map((role, index) => {
                const selected = form.target_roles.includes(role);
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "motion-control grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 px-5 py-4 text-left sm:px-6",
                      selected ? "bg-[#fff5f4]" : "bg-white hover:bg-[#f8f9fa]",
                    )}
                    key={role}
                    onClick={() => toggleRole(role)}
                    type="button"
                  >
                    <span className={cn("grid h-8 w-8 place-items-center rounded-md border text-xs font-bold", selected ? "border-[#FF5A4E] bg-[#FF5A4E] text-white" : "border-border bg-[#f7f8f9] text-muted-foreground")}>
                      {selected ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">{role}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{getRoleTheme(role)}</span>
                    </span>
                    <span className={cn("hidden rounded-md px-2.5 py-1 text-[10px] font-bold uppercase sm:inline-flex", selected ? "bg-[#ffe2df] text-[#A63832]" : "bg-[#f0f1f3] text-muted-foreground")}>
                      {selected ? "Tracking" : "Add target"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal className="app-surface p-5 sm:p-6" delay={0.08} id="evidence">
            <SectionHeading
              action={(
                <Button onClick={() => updateField("projects", [...form.projects, { name: "", description: "", url: "", skills: [] }])} type="button" variant="secondary">
                  <Plus className="h-4 w-4" />
                  Add project
                </Button>
              )}
              description="Make skills searchable and connect them to concrete work."
              title="Skills and project evidence"
            />

            <div className="mt-6 border-y border-border bg-[#f8f9fa] px-4 py-5 sm:px-5">
              <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">Skill inventory</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Python, FastAPI, PostgreSQL"
                  value={skillInput}
                />
                <Button className="shrink-0" onClick={addSkill} type="button">
                  <Plus className="h-4 w-4" />
                  Add skill
                </Button>
              </div>
              <div className="mt-4 flex min-h-8 flex-wrap gap-2">
                {form.skills.length ? form.skills.map((skill) => (
                  <button aria-label={`Remove ${skill}`} className="motion-control inline-flex items-center gap-2 rounded-md border border-[#b7e7ea] bg-[#effbfc] px-2.5 py-1.5 text-sm font-semibold text-[#167D87] hover:border-[#2BC3CE] hover:bg-white" key={skill} onClick={() => updateField("skills", form.skills.filter((item) => item !== skill))} title={`Remove ${skill}`} type="button">
                    {skill}
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                )) : <p className="text-sm text-muted-foreground">No skills added yet.</p>}
              </div>
            </div>

            <div className="divide-y divide-border">
              {form.projects.length ? form.projects.map((project, index) => (
                <article className="py-6" key={`${project.name}-${index}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#101318] text-xs font-bold text-white">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-foreground">{project.name || "Untitled project"}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">Structured project evidence</p>
                      </div>
                    </div>
                    <button aria-label={`Remove ${project.name || "project"}`} className="motion-control grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:border-[#f0b5b0] hover:bg-[#fff3f2] hover:text-[#D9473F]" onClick={() => updateField("projects", form.projects.filter((_, projectIndex) => projectIndex !== index))} title="Remove project" type="button">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-5 grid gap-x-5 gap-y-4 md:grid-cols-2">
                    <Field label="Project name"><Input onChange={(event) => { const projects = [...form.projects]; projects[index] = { ...project, name: event.target.value }; updateField("projects", projects); }} placeholder="RAG assistant" value={project.name} /></Field>
                    <Field label="Project URL"><Input onChange={(event) => { const projects = [...form.projects]; projects[index] = { ...project, url: emptyToNull(event.target.value) }; updateField("projects", projects); }} placeholder="https://github.com/username/project" value={project.url ?? ""} /></Field>
                    <Field className="md:col-span-2" label="What did you build?"><Textarea className="min-h-28" onChange={(event) => { const projects = [...form.projects]; projects[index] = { ...project, description: emptyToNull(event.target.value) }; updateField("projects", projects); }} placeholder="Describe the problem, your contribution, and outcome." value={project.description ?? ""} /></Field>
                    <Field className="md:col-span-2" label="Project skills"><Input onChange={(event) => { const projects = [...form.projects]; projects[index] = { ...project, skills: splitTags(event.target.value) }; updateField("projects", projects); }} placeholder="Python, FastAPI, PostgreSQL" value={project.skills.join(", ")} /></Field>
                  </div>
                </article>
              )) : (
                <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><CircleCheck className="h-5 w-5 text-[#2BC3CE]" />Add a project to strengthen your profile evidence.</div>
              )}
            </div>
          </Reveal>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Reveal className="app-surface p-5" delay={0.06}>
            <SectionHeading
              action={<Button aria-label="Add language" onClick={() => updateField("languages", [...form.languages, { name: "", level: "B2" }])} size="icon" title="Add language" type="button" variant="secondary"><Plus className="h-4 w-4" /></Button>}
              description="Languages you can interview in."
              title="Languages"
            />
            <div className="mt-5 space-y-3">
              {form.languages.length ? form.languages.map((language, index) => (
                <div className="grid grid-cols-[minmax(0,1fr)_78px_auto] gap-2" key={`${language.name}-${index}`}>
                  <Input aria-label={`Language ${index + 1}`} onChange={(event) => { const languages = [...form.languages]; languages[index] = { ...language, name: event.target.value }; updateField("languages", languages); }} placeholder="English" value={language.name} />
                  <Select aria-label={`Language ${index + 1} level`} onChange={(event) => { const languages = [...form.languages]; languages[index] = { ...language, level: event.target.value }; updateField("languages", languages); }} value={language.level}>
                    {languageLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </Select>
                  <button aria-label={`Remove ${language.name || "language"}`} className="motion-control grid h-10 w-10 place-items-center rounded-md border border-border text-muted-foreground hover:border-[#f0b5b0] hover:text-[#D9473F] disabled:cursor-not-allowed disabled:opacity-40" disabled={form.languages.length === 1} onClick={() => updateField("languages", form.languages.filter((_, itemIndex) => itemIndex !== index))} title="Remove language" type="button"><X className="h-4 w-4" /></button>
                </div>
              )) : <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">No languages added.</p>}
            </div>
          </Reveal>

          <Reveal className="overflow-hidden rounded-lg border border-[#272c33] bg-[#101318] text-white" delay={0.1}>
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#2BC3CE]"><Languages className="h-4 w-4" />Evidence inventory</div>
            </div>
            <dl className="grid grid-cols-2">
              <Signal label="Roles" value={form.target_roles.length.toString()} />
              <Signal label="Skills" value={form.skills.length.toString()} />
              <Signal label="Projects" value={form.projects.filter((project) => project.name).length.toString()} />
              <Signal label="Languages" value={form.languages.filter((language) => language.name).length.toString()} />
            </dl>
          </Reveal>

          <Reveal className="border-l-2 border-[#FF5A4E] bg-[#fff5f4] px-5 py-5" delay={0.14}>
            <p className="text-xs font-bold uppercase text-[#A63832]">Continue building</p>
            <div className="mt-3 grid gap-1">
              <Link className="group flex items-center justify-between py-2 text-sm font-bold text-foreground" href="/resume">Review CV <ArrowRight className="h-4 w-4 text-[#D9473F] transition group-hover:translate-x-0.5" /></Link>
              <Link className="group flex items-center justify-between py-2 text-sm font-bold text-foreground" href="/projects">Analyze projects <ArrowRight className="h-4 w-4 text-[#D9473F] transition group-hover:translate-x-0.5" /></Link>
            </div>
          </Reveal>
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
    idle: "bg-[#89909A]",
    saving: "bg-[#F0A13A] animate-pulse",
    saved: "bg-[#2BC3CE]",
    invalid: "bg-[#f0a13a]",
    error: "bg-[#FF5A4E]",
  }[state];

  return (
    <div aria-live="polite" className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-semibold text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span>{copy}</span>
      {state === "error" ? (
        <button className="motion-control font-bold text-[#D9473F] hover:text-foreground" onClick={onRetry} type="button">
          Retry save
        </button>
      ) : null}
    </div>
  );
}

function Field({
  children,
  className,
  icon: Icon,
  label,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  icon?: typeof GraduationCap;
  label: string;
}>) {
  return (
    <div className={className}>
      <Label className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[#D9473F]" /> : null}
        {label}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Signal({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border-b border-r border-white/10 p-5 even:border-r-0 last:border-b-0 [&:nth-last-child(2)]:border-b-0">
      <dt className="text-[10px] font-bold uppercase text-white/42">{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-white">{value}</dd>
    </div>
  );
}
