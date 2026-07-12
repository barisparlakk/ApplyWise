"use client";

import { BrandMark } from "@/components/brand";
import { useTranslations } from "@/components/locale-provider";

export default function OnboardingLoading() {
  const t = useTranslations();

  return (
    <main className="grid min-h-screen place-items-center bg-[#101318] text-white">
      <div className="flex flex-col items-center">
        <BrandMark animated className="h-14 w-14" />
        <p className="mt-4 text-sm font-semibold text-white/[0.64]">{t("Preparing your workspace")}</p>
      </div>
    </main>
  );
}
