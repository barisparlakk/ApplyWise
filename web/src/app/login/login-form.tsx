"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const [email, setEmail] = useState("");

  return (
    <div className="w-full max-w-sm">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn("email", { email, callbackUrl });
        }}
      >
        <label className="block text-sm font-medium text-foreground" htmlFor="email">
          Email
        </label>
        <input
          className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <button
          className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          type="submit"
        >
          Continue with email
        </button>
      </form>

      <div className="my-6 h-px bg-border" />

      <button
        className="h-11 w-full rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground"
        onClick={() => void signIn("github", { callbackUrl })}
        type="button"
      >
        Continue with GitHub
      </button>
    </div>
  );
}
