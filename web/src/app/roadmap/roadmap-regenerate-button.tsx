"use client";

import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { apiError, JSON_HEADERS } from "@/lib/client-api";

type RoadmapRegenerateButtonProps = {
  apiBaseUrl: string;
  durationDays: number;
  jobPostId: string;
};

export function RoadmapRegenerateButton({
  apiBaseUrl,
  durationDays,
  jobPostId,
}: Readonly<RoadmapRegenerateButtonProps>) {
  const router = useRouter();
  const t = useTranslations();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    try {
      setIsBusy(true);
      setError(null);
      const response = await fetch(
        `${apiBaseUrl}/roadmap/${jobPostId}/regenerate?duration_days=${durationDays}`,
        { method: "POST", headers: JSON_HEADERS },
      );
      if (!response.ok) {
        throw await apiError(response, t("Roadmap regeneration failed"));
      }
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? t(requestError.message)
          : t("Roadmap regeneration failed"),
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#A63832]" role="alert">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </span>
      ) : null}
      <Button
        aria-label={t(isBusy ? "Regenerating roadmap" : "Regenerate roadmap")}
        disabled={isBusy}
        onClick={() => void regenerate()}
        size="icon"
        title={t(isBusy ? "Regenerating roadmap" : "Regenerate roadmap")}
        type="button"
        variant="secondary"
      >
        {isBusy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
