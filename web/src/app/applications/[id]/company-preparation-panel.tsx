"use client";

import {
  AlertTriangle,
  BrainCircuit,
  Building2,
  FolderGit2,
  LoaderCircle,
  MessageCircleQuestion,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { Reveal } from "@/components/motion";
import { useTranslations } from "@/components/locale-provider";
import { SectionHeading } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { CompanyProfileData } from "@/lib/api";
import { apiError } from "@/lib/client-api";

type CompanyPreparationPanelProps = {
  apiBaseUrl: string;
  initialProfile: CompanyProfileData | null;
  jobPostId: string;
};

export function CompanyPreparationPanel({
  apiBaseUrl,
  initialProfile,
  jobPostId,
}: CompanyPreparationPanelProps) {
  const t = useTranslations();
  const [profile, setProfile] = useState(initialProfile);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateProfile() {
    try {
      setIsGenerating(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/company-profiles/job/${jobPostId}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw await apiError(response, t("Company preparation could not be generated."));
      }
      setProfile((await response.json()) as CompanyProfileData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? t(requestError.message)
          : t("Company preparation could not be generated."),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Reveal className="app-surface overflow-hidden" delay={0.08}>
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <SectionHeading
          description={t("Preparation derived from this job post and your verified project evidence.")}
          title={t("Company-specific preparation")}
        />
        <Button
          disabled={isGenerating}
          onClick={() => void generateProfile()}
          type="button"
          variant={profile ? "secondary" : "primary"}
        >
          {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : profile ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {t(isGenerating ? "Generating" : profile ? "Regenerate" : "Generate preparation")}
        </Button>
      </div>

      {profile ? (
        <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}>
          <section className="grid gap-4 border-b border-border bg-[#101318] p-5 text-white sm:grid-cols-[44px_1fr] sm:p-6">
            <span className="grid h-11 w-11 place-items-center rounded-md border border-white/[0.12] bg-white/[0.08] text-[#2BC3CE]">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase text-[#FF786D]">{t("Job-post evidence only")}</p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/[0.72]">{profile.what_company_does}</p>
            </div>
          </section>

          <div className="grid lg:grid-cols-3">
            <PreparationSection icon={BrainCircuit} title={t("Likely interview angles")}>
              <ol className="divide-y divide-border">
                {profile.likely_interview_angles.map((angle, index) => (
                  <li className="grid grid-cols-[26px_1fr] gap-3 py-3 text-sm leading-6 text-foreground" key={angle}>
                    <span className="text-[10px] font-bold text-[#D9473F]">{String(index + 1).padStart(2, "0")}</span>
                    {angle}
                  </li>
                ))}
              </ol>
            </PreparationSection>

            <PreparationSection icon={FolderGit2} title={t("Projects to emphasize")}>
              {profile.projects_to_emphasize.length ? (
                <div className="divide-y divide-border">
                  {profile.projects_to_emphasize.map((project) => (
                    <div className="py-3" key={project.name}>
                      <h3 className="text-sm font-bold text-foreground">{project.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{project.reason}</p>
                      <ul className="mt-2 space-y-1">
                        {project.talking_points.map((point) => <li className="text-xs leading-5 text-foreground" key={point}>- {point}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">{t("Add a project before generating emphasis guidance.")}</p>
              )}
            </PreparationSection>

            <PreparationSection icon={MessageCircleQuestion} title={t("Smart questions to ask")}>
              <ul className="divide-y divide-border">
                {profile.smart_questions.map((question) => (
                  <li className="py-3 text-sm leading-6 text-foreground" key={question}>{question}</li>
                ))}
              </ul>
            </PreparationSection>
          </div>
        </motion.div>
      ) : (
        <div className="grid min-h-48 place-items-center p-6 text-center">
          <div>
            <Building2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold text-foreground">{t("No company preparation generated")}</p>
          </div>
        </div>
      )}

      {error ? (
        <p className="flex items-center gap-2 border-t border-[#f0b5b0] bg-[#fff3f2] px-5 py-3 text-sm font-semibold text-[#A63832]" role="alert">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </p>
      ) : null}
    </Reveal>
  );
}

function PreparationSection({
  children,
  icon: Icon,
  title,
}: Readonly<{
  children: React.ReactNode;
  icon: typeof BrainCircuit;
  title: string;
}>) {
  return (
    <section className="min-w-0 border-b border-border p-5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 lg:p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-foreground">
        <Icon className="h-4 w-4 text-[#D9473F]" />
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
