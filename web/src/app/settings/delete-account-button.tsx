"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
      <Button onClick={() => setIsConfirming(true)} type="button" variant="danger">
        <Trash2 className="h-4 w-4" />
        Delete account
      </Button>
    );
  }

  return (
    <motion.div animate={{ opacity: 1, y: 0 }} className="max-w-md rounded-md border border-[#f0b5b0] bg-white p-4 shadow-sm" initial={{ opacity: 0, y: 4 }}>
      <p className="flex items-center gap-2 text-sm font-bold text-[#A63832]"><AlertTriangle className="h-4 w-4" />Permanently delete this account?</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        This removes your profile, CVs, repository analyses, jobs, applications, roadmaps, and
        interview preparation. This action cannot be undone.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={isDeleting} onClick={() => void deleteAccount()} type="button" variant="danger">
          {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {isDeleting ? "Deleting" : "Delete permanently"}
        </Button>
        <Button
          disabled={isDeleting}
          onClick={() => setIsConfirming(false)}
          type="button"
          variant="secondary"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
      <AnimatePresence>{errorMessage ? <motion.p animate={{ opacity: 1 }} className="mt-3 text-sm font-semibold text-[#A63832]" exit={{ opacity: 0 }} initial={{ opacity: 0 }}>{errorMessage}</motion.p> : null}</AnimatePresence>
    </motion.div>
  );
}
