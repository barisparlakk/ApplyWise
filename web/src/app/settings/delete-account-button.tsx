"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiError } from "@/lib/client-api";

export function DeleteAccountButton() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function deleteAccount() {
    setIsDeleting(true);
    setErrorMessage(null);

    const response = await fetch("/api/backend/auth/me", { method: "DELETE" });
    if (!response.ok) {
      setErrorMessage((await apiError(response, "Account deletion failed")).message);
      setIsDeleting(false);
      return;
    }

    await signOut({ callbackUrl: "/" });
  }

  if (!isConfirming) {
    return (
      <Button onClick={() => setIsConfirming(true)} type="button" variant="secondary">
        Delete account
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-[#e6b9b5] bg-[#fff8f7] p-4">
      <p className="text-sm font-semibold text-[#8e3934]">Permanently delete this account?</p>
      <p className="mt-2 text-sm leading-6 text-[#754b48]">
        This removes your profile, CVs, repository analyses, jobs, applications, roadmaps, and
        interview preparation. This action cannot be undone.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={isDeleting} onClick={() => void deleteAccount()} type="button">
          {isDeleting ? "Deleting" : "Delete permanently"}
        </Button>
        <Button
          disabled={isDeleting}
          onClick={() => setIsConfirming(false)}
          type="button"
          variant="secondary"
        >
          Cancel
        </Button>
      </div>
      {errorMessage ? <p className="mt-3 text-sm text-[#8e3934]">{errorMessage}</p> : null}
    </div>
  );
}
