"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

type LoginFormProps = {
  callbackUrl: string;
  emailEnabled: boolean;
  githubEnabled: boolean;
};

export function LoginForm({ callbackUrl, emailEnabled, githubEnabled }: LoginFormProps) {
  const [email, setEmail] = useState("demo@applywise.dev");

  return (
    <div className="w-full">
      {emailEnabled ? (
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
            className="h-11 w-full rounded-md border border-border bg-white px-3 text-sm shadow-sm outline-none ring-primary/20 transition focus:border-primary focus:ring-4"
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="demo@applywise.dev"
            required
            type="email"
            value={email}
          />
          <button
            className="h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-[#176e60]"
            type="submit"
          >
            Continue with email
          </button>
        </form>
      ) : null}

      {emailEnabled && githubEnabled ? <div className="my-6 h-px bg-border" /> : null}

      {githubEnabled ? (
        <>
          <button
            className="h-11 w-full rounded-md border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-sm transition hover:border-[#6cb5a3] hover:bg-[#f4fbf8]"
            onClick={() => void signIn("github", { callbackUrl })}
            type="button"
          >
            Continue with GitHub
          </button>
        </>
      ) : null}
    </div>
  );
}
