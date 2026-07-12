"use client";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  FileCheck2,
  FileText,
  FolderGit2,
  GraduationCap,
  Languages,
  LoaderCircle,
  Plus,
  ScanSearch,
  Target,
  UploadCloud,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
const sectionMetadata: Array<{
  icon: LucideIcon;
  key: keyof ResumeData["parsed_data"];
  label: string;
}> = [
  { icon: GraduationCap, key: "education", label: "Education" },
  { icon: BriefcaseBusiness, key: "experience", label: "Experience" },
  { icon: Wrench, key: "skills", label: "Skills" },
  { icon: FolderGit2, key: "projects", label: "Projects" },
];

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
  const reduceMotion = useReducedMotion();
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

  const stepMotion = reduceMotion
    ? {}
    : { initial: { opacity: 0, x: 12 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -8 } };

  return (
    <main className="min-h-screen bg-[#f5f6f8] lg:grid lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="relative overflow-hidden bg-[#101318] px-6 py-6 text-white sm:px-9 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-9 lg:py-9">
        <SignalField compact />
        <div className="relative z-10">
          <BrandLockup />
          <div className="mt-14 hidden lg:block">
            <p className="flex items-center gap-2 text-xs font-bold uppercase text-[#FF786D]"><ScanSearch className="h-4 w-4" /> Evidence setup</p>
            <h1 className="mt-5 text-4xl font-bold leading-tight">Give every decision a stronger signal.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/[0.62]">Start with your current CV. ApplyWise will map what you have before asking where you want to go.</p>
          </div>
        </div>

        <ol className="relative z-10 mt-7 grid grid-cols-2 gap-2 lg:block lg:space-y-2">
          <SetupStep active={step === 1} complete={Boolean(resume)} icon={FileText} label="Evidence scan" number="01" />
          <SetupStep active={step === 2} complete={false} icon={Target} label="Target direction" number="02" />
        </ol>
      </aside>

      <section className="flex min-h-[calc(100vh-178px)] justify-center px-5 py-8 sm:px-8 lg:min-h-screen lg:px-12 lg:py-12 xl:px-16">
        <div className="w-full max-w-[820px]">
          <div className="mb-10 flex items-center justify-between gap-5 border-b border-border pb-5">
            <div>
              <p className="text-xs font-bold uppercase text-[#a63832]">Step {step} of 2</p>
              <p className="mt-1 text-sm text-muted-foreground">{userName ? `Welcome, ${userName}.` : "Welcome to ApplyWise."}</p>
            </div>
            <div className="grid w-32 grid-cols-2 gap-1" aria-label={`Step ${step} of 2`}>
              <span className="h-1.5 rounded-full bg-[#D9473F]" />
              <motion.span animate={{ backgroundColor: step === 2 ? "#D9473F" : "#dfe3e7" }} className="h-1.5 rounded-full" transition={{ duration: 0.3 }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.section {...stepMotion} aria-labelledby="cv-step-title" key="resume">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff0ef] text-[#D9473F]"><UploadCloud className="h-5 w-5" /></div>
                <h2 className="mt-5 text-3xl font-bold text-foreground sm:text-4xl" id="cv-step-title">Start with your current CV</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Education, experience, skills, and projects become the evidence layer behind every fit score.</p>

                <label
                  className={cn(
                    "relative mt-8 flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed px-6 text-center transition",
                    isDragging ? "border-[#D9473F] bg-[#fff4f3]" : "border-[#aeb5bd] bg-white hover:border-[#D9473F] hover:bg-[#fffafa]",
                  )}
                  htmlFor="onboarding-cv"
                  onDragEnter={() => setIsDragging(true)}
                  onDragLeave={() => setIsDragging(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  {submitState === "uploading" ? <motion.span animate={{ x: ["-100%", "100%"] }} className="absolute inset-x-0 top-0 h-0.5 bg-[#2BC3CE]" transition={{ duration: 1.1, repeat: Infinity }} /> : null}
                  <span className="grid h-12 w-12 place-items-center rounded-md bg-[#101318] text-white">{submitState === "uploading" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : resume ? <FileCheck2 className="h-5 w-5 text-[#2BC3CE]" /> : <UploadCloud className="h-5 w-5 text-[#FF6B60]" />}</span>
                  <span className="mt-4 text-base font-bold text-foreground">{submitState === "uploading" ? "Scanning evidence" : resume ? "Replace uploaded CV" : "Drop your CV here"}</span>
                  <span className="mt-1 text-sm text-muted-foreground">PDF or DOCX, up to 10 MB</span>
                  <input accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" disabled={submitState === "uploading"} id="onboarding-cv" onChange={(event) => void uploadResume(event.target.files?.[0] ?? null)} type="file" />
                </label>

                {resume ? (
                  <motion.div animate={{ opacity: 1, y: 0 }} className="mt-6 border-y border-border bg-white" initial={reduceMotion ? false : { opacity: 0, y: 8 }}>
                    <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3"><FileCheck2 className="h-4 w-4 shrink-0 text-[#1F9D68]" /><p className="truncate text-sm font-bold text-foreground">{resume.filename}</p></div>
                      <p className="text-xs font-bold text-muted-foreground">{populatedSections}/4 evidence groups</p>
                    </div>
                    <div className="grid sm:grid-cols-2">
                      {sectionMetadata.map(({ icon: Icon, key, label }, index) => {
                        const count = resume.parsed_data[key].length;
                        return (
                          <div className={cn("flex items-center justify-between px-4 py-3.5", index < 2 && "sm:border-b", index % 2 === 0 && "sm:border-r", index < 3 && "border-b")} key={key}>
                            <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-muted-foreground" />{label}</span>
                            <span className={cn("text-xs font-bold", count ? "text-[#167D87]" : "text-[#A63832]")}>{count ? `${count} found` : "Review"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}

                <div className="mt-8 flex justify-end">
                  <Button disabled={!resume || submitState === "uploading"} onClick={() => { setStep(2); setErrorMessage(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} type="button">Continue <ArrowRight className="h-4 w-4" /></Button>
                </div>
              </motion.section>
            ) : (
              <motion.section {...stepMotion} aria-labelledby="profile-step-title" key="direction">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eaf9fa] text-[#167D87]"><Target className="h-5 w-5" /></div>
                <h2 className="mt-5 text-3xl font-bold text-foreground sm:text-4xl" id="profile-step-title">Choose your direction</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Confirm the minimum context ApplyWise needs to compare you with internship roles.</p>

                <div className="mt-8 divide-y divide-border border-y border-border bg-white px-4 sm:px-5">
                  <div className="grid gap-4 py-5 sm:grid-cols-[180px_1fr]">
                    <FieldLabel icon={GraduationCap} label="Education" />
                    <Input id="education" maxLength={120} onChange={(event) => updateField("education", event.target.value)} placeholder="BSc Computer Engineering, third year" value={form.education} />
                  </div>

                  <fieldset className="grid gap-4 py-5 sm:grid-cols-[180px_1fr]">
                    <FieldLabel asLegend icon={Target} label="Target roles" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {initialSnapshot.target_role_options.map((role) => {
                        const selected = form.target_roles.includes(role);
                        return (
                          <label className={cn("motion-control flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm", selected ? "border-[#e28f88] bg-[#fff2f1] text-[#912f2a]" : "border-border bg-[#fafbfc] text-foreground hover:border-[#a8afb8]")} key={role}>
                            <input checked={selected} className="sr-only" onChange={() => updateField("target_roles", selected ? form.target_roles.filter((value) => value !== role) : [...form.target_roles, role])} type="checkbox" />
                            <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded border", selected ? "border-[#D9473F] bg-[#D9473F] text-white" : "border-[#b7bdc5] bg-white")}>{selected ? <Check className="h-3.5 w-3.5" /> : null}</span>
                            <span className="font-semibold">{role}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid gap-4 py-5 sm:grid-cols-[180px_1fr]">
                    <FieldLabel icon={BriefcaseBusiness} label="Experience" />
                    <Select id="experience-level" onChange={(event) => updateField("experience_level", event.target.value)} value={form.experience_level}><option value="">Select a level</option>{experienceLevels.map((level) => <option key={level} value={level}>{level}</option>)}</Select>
                  </div>

                  <div className="grid gap-4 py-5 sm:grid-cols-[180px_1fr]">
                    <FieldLabel icon={Languages} label="English" />
                    <Select id="english-level" onChange={(event) => updateField("english_level", event.target.value)} value={form.english_level}><option value="">Select a level</option>{englishLevels.map((level) => <option key={level} value={level}>{level}</option>)}</Select>
                  </div>

                  <div className="grid gap-4 py-5 sm:grid-cols-[180px_1fr]">
                    <FieldLabel icon={Wrench} label="Skills" />
                    <div>
                      <div className="flex gap-2"><Input id="skill-input" onChange={(event) => setSkillInput(event.target.value)} onKeyDown={handleSkillKeyDown} placeholder="Python, SQL, FastAPI" value={skillInput} /><Button aria-label="Add skills" onClick={addSkills} size="icon" type="button" variant="secondary"><Plus className="h-4 w-4" /></Button></div>
                      {form.skills.length ? <div className="mt-3 flex flex-wrap gap-2">{form.skills.map((skill) => <button className="data-chip motion-control gap-2 hover:border-[#e28f88] hover:text-[#a63832]" key={skill} onClick={() => updateField("skills", form.skills.filter((value) => value !== skill))} title={`Remove ${skill}`} type="button">{skill}<X className="h-3 w-3" /></button>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Add at least one skill.</p>}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <Button onClick={() => { setStep(1); setErrorMessage(null); }} type="button" variant="secondary"><ArrowLeft className="h-4 w-4" />Back</Button>
                  <Button disabled={submitState === "submitting"} onClick={() => void completeSetup()} type="button">{submitState === "submitting" ? <><LoaderCircle className="h-4 w-4 animate-spin" />Creating workspace</> : <>Enter workspace <ArrowRight className="h-4 w-4" /></>}</Button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <div aria-live="polite" className="mt-5 min-h-6">{errorMessage ? <p className="flex items-center gap-2 text-sm font-semibold text-[#a63832]"><span className="h-1.5 w-1.5 rounded-full bg-[#D9473F]" />{errorMessage}</p> : null}</div>
        </div>
      </section>
    </main>
  );
}

function SetupStep({ active, complete, icon: Icon, label, number }: { active: boolean; complete: boolean; icon: LucideIcon; label: string; number: string }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-md border px-3 py-3 transition", active ? "border-white/[0.18] bg-white/[0.09] text-white" : "border-transparent text-white/[0.42]")}>
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[10px] font-bold", active || complete ? "border-[#FF786D]/[0.45] bg-[#FF5A4E]/[0.12] text-[#FF8C83]" : "border-white/[0.10]")}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span>
      <Icon className="hidden h-4 w-4 lg:block" />
      <span className="text-xs font-bold sm:text-sm">{label}</span>
    </li>
  );
}

function FieldLabel({ asLegend = false, icon: Icon, label }: { asLegend?: boolean; icon: LucideIcon; label: string }) {
  const content = <><Icon className="h-4 w-4 text-[#167D87]" /><span>{label}</span></>;
  return asLegend ? <legend className="flex items-center gap-2 text-sm font-bold text-foreground">{content}</legend> : <Label className="flex items-center gap-2 pt-3 text-sm font-bold text-foreground">{content}</Label>;
}
import { BrandLockup } from "@/components/brand";
import { SignalField } from "@/components/signal-field";
