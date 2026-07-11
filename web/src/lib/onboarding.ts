import type { ProfileSnapshot, ResumeData } from "@/lib/api";

export function isOnboardingComplete(
  snapshot: ProfileSnapshot,
  resume: ResumeData | null,
): boolean {
  const { profile } = snapshot;
  const hasEnglish = profile.languages.some(
    (language) => language.name.toLowerCase() === "english" && Boolean(language.level.trim()),
  );

  return Boolean(
    resume &&
      profile.education &&
      profile.target_roles.length > 0 &&
      profile.experience_level &&
      profile.skills.length > 0 &&
      hasEnglish,
  );
}

export function safeOnboardingDestination(value: string | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  if (["/login", "/onboarding", "/start"].some((path) => value.startsWith(path))) {
    return "/dashboard";
  }
  return value;
}
