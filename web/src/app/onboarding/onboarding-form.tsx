"use client";

import { useRouter } from "next/navigation";
import type { DragEvent, KeyboardEvent } from "react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ProfileSnapshot, ResumeData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const onboardingSchema = z.object({
  education: z.string().trim().min(2, "Add your current education.").max(120),
  target_roles: z.array(z.string()).min(1, "Select at least one target role."),
  experience_level: z.string().trim().min(2, "Select your experience level."),
  english_level: z.string().trim().min(2, "Select your English level."),
  skills: z.array(z.string()).min(1, "Add at least one skill."),
});

type OnboardingState = z.infer<typeof onboardingSchema>;
type SubmitState = "idle" | "uploading" | "submitting" | "error";

type OnboardingFormProps = {
  apiBaseUrl: string;
  initialResume: ResumeData | null;
  initialSnapshot: ProfileSnapshot;
  nextPath: string;
  userName: string | null;
};

const experienceLevels = [
  "No professional experience",
  "Coursework only",
  "Project experience",
  "Prior internship",
  "Freelance or part-time experience",
];
const englishLevels = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
const sectionLabels = {
  education: "Education",
  experience: "Experience",
  skills: "Skills",
  projects: "Projects",
} as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The CV could not be read."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The CV could not be read."));
        return;
      }
      resolve(reader.result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

function initialState(snapshot: ProfileSnapshot, resume: ResumeData | null): OnboardingState {
  const english = snapshot.profile.languages.find(
    (language) => language.name.toLowerCase() === "english",
  );
  const parsedEducation = resume?.parsed_data.education[0] ?? "";
  const parsedSkills = resume?.parsed_data.skills ?? [];

  return {
    education: (snapshot.profile.education ?? parsedEducation).slice(0, 120),
    target_roles: snapshot.profile.target_roles,
    experience_level: snapshot.profile.experience_level ?? "",
    english_level: english?.level ?? "",
    skills: snapshot.profile.skills.length ? snapshot.profile.skills : parsedSkills,
  };
}

function splitSkills(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (!skill || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function OnboardingForm({
  apiBaseUrl,
  initialResume,
  initialSnapshot,
  nextPath,
  userName,
}: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(initialResume ? 2 : 1);
  const [resume, setResume] = useState<ResumeData | null>(initialResume);
  const [form, setForm] = useState<OnboardingState>(() =>
    initialState(initialSnapshot, initialResume),
  );
  const [skillInput, setSkillInput] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const populatedSections = resume
    ? Object.values(resume.parsed_data).filter((values) => values.length > 0).length
    : 0;

  function updateField<Key extends keyof OnboardingState>(
    key: Key,
    value: OnboardingState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addSkills() {
    const additions = splitSkills(skillInput);
    if (!additions.length) {
      return;
    }
    updateField("skills", splitSkills([...form.skills, ...additions].join(",")));
    setSkillInput("");
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkills();
    }
  }

  async function uploadResume(file: File | null) {
    if (!file) {
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx")) {
      setErrorMessage("Choose a PDF or DOCX file.");
      setSubmitState("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Choose a file that is 10 MB or smaller.");
      setSubmitState("error");
      return;
    }

    try {
      setSubmitState("uploading");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/resume/upload`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          filename: file.name,
          content_base64: await fileToBase64(file),
        }),
      });
      if (!response.ok) {
        throw await apiError(response, "CV upload failed");
      }

      const uploadedResume = (await response.json()) as ResumeData;
      setResume(uploadedResume);
      setForm((current) => ({
        ...current,
        education: current.education || (uploadedResume.parsed_data.education[0] ?? "").slice(0, 120),
        skills: current.skills.length ? current.skills : uploadedResume.parsed_data.skills,
      }));
      setSubmitState("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "CV upload failed.");
      setSubmitState("error");
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void uploadResume(event.dataTransfer.files[0] ?? null);
  }

  async function completeSetup() {
    const parsed = onboardingSchema.safeParse(form);
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Complete the required fields.");
      setSubmitState("error");
      return;
    }
    if (!resume) {
      setStep(1);
      setErrorMessage("Upload a CV before continuing.");
      setSubmitState("error");
      return;
    }

    try {
      setSubmitState("submitting");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/onboarding`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        throw await apiError(response, "Setup could not be completed");
      }
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Setup could not be completed.");
      setSubmitState("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8f7] lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="relative overflow-hidden bg-[#10221f] px-6 py-7 text-white sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-9 lg:py-10">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d7f75b] text-xs font-bold text-[#10221f]">AW</span>
            <span className="font-semibold">ApplyWise</span>
          </div>
          <div className="mt-10 hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9fb8b2]">First setup</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight">Start with evidence, then choose your direction.</h1>
            <p className="mt-4 text-sm leading-6 text-[#bed2cd]">Your CV gives the fit engine a factual baseline. You can correct every extracted field before using it.</p>
          </div>
        </div>
        <ol className="mt-7 grid grid-cols-2 gap-3 lg:block lg:space-y-3">
          <SetupStep active={step === 1} complete={Boolean(resume)} label="Upload and review CV" number="01" />
          <SetupStep active={step === 2} complete={false} label="Set your direction" number="02" />
        </ol>
      </aside>

      <section className="flex min-h-[calc(100vh-180px)] justify-center px-5 py-8 sm:px-8 lg:min-h-screen lg:items-center lg:px-12 lg:py-12">
        <div className="page-entrance w-full max-w-3xl">
          <div className="mb-8 flex items-center justify-between gap-5">
            <div>
              <p className="app-kicker">Step {step} of 2</p>
              <p className="mt-2 text-sm text-muted-foreground">{userName ? `Welcome, ${userName}.` : "Welcome to ApplyWise."}</p>
            </div>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#dce8e4] sm:w-40" aria-hidden="true">
              <div className="h-full bg-primary transition-[width] duration-500" style={{ width: step === 1 ? "50%" : "100%" }} />
            </div>
          </div>

          {step === 1 ? (
            <section aria-labelledby="cv-step-title">
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl" id="cv-step-title">Add your current CV</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">We will extract education, experience, skills, and projects to prefill your profile.</p>

              <label
                className={cn(
                  "mt-8 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center shadow-sm transition",
                  isDragging
                    ? "border-primary bg-[#eaf7f2]"
                    : "border-[#8fbcae] bg-white hover:border-primary hover:bg-[#f8fcfa]",
                )}
                htmlFor="onboarding-cv"
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <span className="grid h-12 w-12 place-items-center rounded-md bg-[#d7f75b] text-sm font-bold text-[#10221f]">CV</span>
                <span className="mt-4 text-base font-semibold text-foreground">{submitState === "uploading" ? "Reading your CV" : resume ? "Replace your CV" : "Drop your CV here"}</span>
                <span className="mt-1 text-sm text-muted-foreground">PDF or DOCX, up to 10 MB</span>
                <input
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  disabled={submitState === "uploading"}
                  id="onboarding-cv"
                  onChange={(event) => void uploadResume(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>

              {resume ? (
                <div className="mt-6 border-y border-border bg-white">
                  <div className="flex flex-col gap-1 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-foreground">{resume.filename}</p>
                    <p className="text-xs font-medium text-muted-foreground">{populatedSections}/4 sections populated</p>
                  </div>
                  <div className="grid sm:grid-cols-2">
                    {Object.entries(sectionLabels).map(([key, label], index) => {
                      const count = resume.parsed_data[key as keyof typeof sectionLabels].length;
                      return (
                        <div className={cn("flex items-center justify-between px-4 py-3 text-sm", index < 2 && "sm:border-b", index % 2 === 0 && "sm:border-r", index < 3 && "border-b")} key={key}>
                          <span className="text-muted-foreground">{label}</span>
                          <span className={cn("font-semibold", count ? "text-primary" : "text-[#a34c47]")}>{count ? `${count} found` : "Review needed"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-7 flex justify-end">
                <Button disabled={!resume || submitState === "uploading"} onClick={() => { setStep(2); setErrorMessage(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} type="button">Continue</Button>
              </div>
            </section>
          ) : (
            <section aria-labelledby="profile-step-title">
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl" id="profile-step-title">Set your internship direction</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Confirm the profile details used to rank roles and calculate fit.</p>

              <div className="mt-8 space-y-7">
                <div className="space-y-2">
                  <Label htmlFor="education">Current education</Label>
                  <Input id="education" maxLength={120} onChange={(event) => updateField("education", event.target.value)} placeholder="BSc Computer Engineering, third year" value={form.education} />
                </div>

                <fieldset>
                  <legend className="text-sm font-medium text-foreground">Target roles</legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {initialSnapshot.target_role_options.map((role) => {
                      const selected = form.target_roles.includes(role);
                      return (
                        <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-md border bg-white px-3 py-2.5 text-sm transition", selected ? "border-primary bg-[#f1faf6] text-[#174f45] shadow-sm" : "border-border text-foreground hover:border-[#8fbcae]")} key={role}>
                          <input checked={selected} className="h-4 w-4 accent-[#217b6b]" onChange={() => updateField("target_roles", selected ? form.target_roles.filter((value) => value !== role) : [...form.target_roles, role])} type="checkbox" />
                          <span className="font-medium">{role}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="experience-level">Experience level</Label>
                    <Select id="experience-level" onChange={(event) => updateField("experience_level", event.target.value)} value={form.experience_level}>
                      <option value="">Select a level</option>
                      {experienceLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="english-level">English level</Label>
                    <Select id="english-level" onChange={(event) => updateField("english_level", event.target.value)} value={form.english_level}>
                      <option value="">Select a level</option>
                      {englishLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="skill-input">Skills</Label>
                  <div className="flex gap-2">
                    <Input id="skill-input" onChange={(event) => setSkillInput(event.target.value)} onKeyDown={handleSkillKeyDown} placeholder="Python, SQL, FastAPI" value={skillInput} />
                    <Button onClick={addSkills} type="button" variant="secondary">Add</Button>
                  </div>
                  {form.skills.length ? (
                    <div className="flex flex-wrap gap-2">
                      {form.skills.map((skill) => (
                        <button className="data-chip motion-control gap-2 hover:border-[#cf8179] hover:text-[#8e3f39]" key={skill} onClick={() => updateField("skills", form.skills.filter((value) => value !== skill))} title={`Remove ${skill}`} type="button">
                          {skill}<span aria-hidden="true">x</span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Add the technical and business skills you want the fit engine to use.</p>}
                </div>
              </div>

              <div className="mt-9 flex items-center justify-between gap-3 border-t border-border pt-6">
                <Button onClick={() => { setStep(1); setErrorMessage(null); }} type="button" variant="secondary">Back</Button>
                <Button disabled={submitState === "submitting"} onClick={() => void completeSetup()} type="button">{submitState === "submitting" ? "Creating workspace" : "Enter workspace"}</Button>
              </div>
            </section>
          )}

          <div aria-live="polite" className="mt-5 min-h-6">
            {errorMessage ? <p className="text-sm font-medium text-[#a34c47]">{errorMessage}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function SetupStep({ active, complete, label, number }: { active: boolean; complete: boolean; label: string; number: string }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-md border px-3 py-3 transition", active ? "border-white/20 bg-white/10" : "border-transparent text-[#9fb8b2]")}>
      <span className={cn("text-xs font-semibold", active || complete ? "text-[#d7f75b]" : "text-[#76928b]")}>{complete ? "OK" : number}</span>
      <span className="text-sm font-medium">{label}</span>
    </li>
  );
}
