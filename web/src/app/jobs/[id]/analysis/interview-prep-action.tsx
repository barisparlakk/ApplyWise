"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
        throw await apiError(response, "Could not create application");
      }

      const application = (await response.json()) as ApplicationData;
      router.push(openPrep ? `/interview-prep/${application.id}` : `/applications/${application.id}`);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not start prep.");
    }
  }

  return (
    <div>
      <div className="grid gap-2">
        <Button disabled={state === "creating"} onClick={() => void saveApplication()} type="button">
          Save application
        </Button>
        <Button
          disabled={state === "creating"}
          onClick={() => void startPrep()}
          type="button"
          variant="secondary"
        >
          {state === "creating" ? "Saving" : "Prepare interview"}
        </Button>
      </div>
      {errorMessage ? <p className="mt-2 text-sm text-red-700">{errorMessage}</p> : null}
    </div>
  );
}
