"use client";

import { AlertTriangle, Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { apiError } from "@/lib/client-api";

export function ExportDataButton() {
  const t = useTranslations();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    try {
      setIsBusy(true);
      setError(null);
      const response = await fetch("/api/backend/auth/me/export", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw await apiError(response, t("Data export failed"));
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "applywise-data-export.json";
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? t(requestError.message) : t("Data export failed"),
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button disabled={isBusy} onClick={() => void exportData()} type="button" variant="secondary">
        {isBusy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {t(isBusy ? "Preparing export" : "Export data")}
      </Button>
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#A63832]" role="alert">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
