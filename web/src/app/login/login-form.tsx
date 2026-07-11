"use client";

import { ArrowRight, GitFork, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

type LoginFormProps = {
  callbackUrl: string;
  emailEnabled: boolean;
  githubEnabled: boolean;
  googleEnabled: boolean;
};

export function LoginForm({ callbackUrl, emailEnabled, githubEnabled, googleEnabled }: LoginFormProps) {
  const [email, setEmail] = useState("demo@applywise.dev");
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const socialLoginEnabled = githubEnabled || googleEnabled;

  async function continueWith(provider: string, options: Record<string, string> = {}) {
    setPendingProvider(provider);
    await signIn(provider, { callbackUrl, ...options });
    setPendingProvider(null);
  }

  return (
    <div className="w-full">
      {socialLoginEnabled ? (
        <div className="space-y-3">
          {googleEnabled ? (
            <button className="motion-control flex h-12 w-full items-center justify-between rounded-md border border-border bg-white px-4 text-sm font-bold text-foreground shadow-sm hover:border-[#a8afb8] hover:bg-[#fafafa] disabled:opacity-60" disabled={pendingProvider !== null} onClick={() => void continueWith("google")} type="button">
              <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded border border-border text-xs font-bold text-[#4285F4]">G</span>Continue with Google</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
          {githubEnabled ? (
            <button className="motion-control flex h-12 w-full items-center justify-between rounded-md border border-border bg-white px-4 text-sm font-bold text-foreground shadow-sm hover:border-[#a8afb8] hover:bg-[#fafafa] disabled:opacity-60" disabled={pendingProvider !== null} onClick={() => void continueWith("github")} type="button">
              <span className="flex items-center gap-3"><GitFork className="h-5 w-5" />Continue with GitHub</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      ) : null}

      {emailEnabled && socialLoginEnabled ? (
        <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase text-muted-foreground"><span className="h-px flex-1 bg-border" />Development access<span className="h-px flex-1 bg-border" /></div>
      ) : null}

      {emailEnabled ? (
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void continueWith("email", { email }); }}>
          <label className="text-sm font-semibold text-foreground" htmlFor="email">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <input className="h-11 w-full rounded-md border border-border bg-white pl-10 pr-3 text-sm shadow-sm outline-none ring-primary/15 focus:border-primary focus:ring-4" id="email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </div>
          <button className="motion-control flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#101318] px-4 text-sm font-bold text-white hover:bg-[#282c34] disabled:opacity-60" disabled={pendingProvider !== null} type="submit">Continue with email <ArrowRight className="h-4 w-4 text-[#FF6B60]" /></button>
        </form>
      ) : null}

      <p aria-live="polite" className="mt-5 min-h-5 text-xs text-muted-foreground">{pendingProvider ? "Opening secure sign-in..." : "Secure access with account-scoped data."}</p>
      <p className="mt-5 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">By continuing, you agree to the <a className="font-bold text-foreground hover:text-primary" href="/terms">terms</a> and acknowledge the <a className="font-bold text-foreground hover:text-primary" href="/privacy">privacy notice</a>.</p>
    </div>
  );
}
