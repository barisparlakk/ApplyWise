"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { ApplicationData } from "@/lib/api";

type InterviewPrepActionProps = {
  apiBaseUrl: string;
  backendToken: string;
  jobPostId: string;
};

type ActionState = "idle" | "creating" | "error";

export function InterviewPrepAction({
  apiBaseUrl,
  backendToken,
  jobPostId,
}: InterviewPrepActionProps) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${backendToken}`,
      "Content-Type": "application/json",
    }),
    [backendToken],
  );

  async function startPrep() {
    try {
      setState("creating");
      setErrorMessage(null);
      const response = await fetch(`${apiBaseUrl}/applications/from-job/${jobPostId}`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Could not create application: ${response.status}.`);
      }

      const application = (await response.json()) as ApplicationData;
      router.push(`/interview-prep/${application.id}`);
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not start prep.");
    }
  }

  return (
    <div>
      <Button disabled={state === "creating"} onClick={() => void startPrep()} type="button">
        {state === "creating" ? "Preparing" : "Prepare interview"}
      </Button>
      {errorMessage ? <p className="mt-2 text-sm text-red-700">{errorMessage}</p> : null}
    </div>
  );
}
