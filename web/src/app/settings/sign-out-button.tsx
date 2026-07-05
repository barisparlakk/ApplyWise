"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="h-10 rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground"
      onClick={() => void signOut({ callbackUrl: "/" })}
      type="button"
    >
      Sign out
    </button>
  );
}
