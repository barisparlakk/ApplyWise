"use client";

import { AlertTriangle, BookmarkPlus, LoaderCircle, MessagesSquare } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/locale-provider";
import type { ApplicationData } from "@/lib/api";
import { apiError, JSON_HEADERS } from "@/lib/client-api";

type InterviewPrepActionProps = {
  apiBaseUrl: string;
  jobPostId: string;
};

type ActionState = "idle" | "creating" | "error";

export function InterviewPrepAction({
  apiBaseUrl,
  jobPostId,
}: InterviewPrepActionProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const t = useTranslations();
  async function startPrep() {
    await createTrackerEntry("preparing", true);
  }

  async function saveApplication() {
    await createTrackerEntry("saved", false);
  }

  async function createTrackerEntry(status: "saved" | "preparing", openPrep: boolean) {
    try {
      setState("creating");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/applications/from-job/${jobPostId}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          status,
          next_action:
            status === "preparing"
              ? "Prepare interview sections."
              : "Review fit score and decide whether to apply.",
        }),
      });

      if (!response.ok) {
        throw await apiError(response, t("Could not create application"));
      }

      const application = (await response.json()) as ApplicationData;
      router.push(openPrep ? `/interview-prep/${application.id}` : `/applications/${application.id}`);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? t(error.message) : t("Could not start prep."));
    }
  }

  return (
    <div>
      <div className="grid gap-2">
        <Button disabled={state === "creating"} onClick={() => void saveApplication()} type="button">
          {state === "creating" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
          {t("Save to pipeline")}
        </Button>
        <Button
          disabled={state === "creating"}
          onClick={() => void startPrep()}
          type="button"
          variant="secondary"
        >
          <MessagesSquare className="h-4 w-4" />
          {state === "creating" ? t("Creating workspace") : t("Start interview prep")}
        </Button>
      </div>
      {errorMessage ? <p className="mt-3 flex items-start gap-2 rounded-md border border-[#f0b5b0] bg-[#fff3f2] p-3 text-sm font-semibold text-[#A63832]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{errorMessage}</p> : null}
    </div>
  );
}
