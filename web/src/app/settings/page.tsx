import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountButton } from "@/app/settings/delete-account-button";
import { SignOutButton } from "@/app/settings/sign-out-button";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

export default async function SettingsPage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/settings");
  }

  const user = await getCurrentUser(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="app-kicker">
              Settings
            </p>
            <h1 className="app-title">Account</h1>
          </div>
          <SignOutButton />
        </div>

        <dl className="mt-10 grid max-w-xl gap-4 text-sm">
          <div className="app-surface p-4">
            <dt className="font-medium text-muted-foreground">Name</dt>
            <dd className="mt-1 text-foreground">{user.full_name ?? "Not set"}</dd>
          </div>
          <div className="app-surface p-4">
            <dt className="font-medium text-muted-foreground">Email</dt>
            <dd className="mt-1 text-foreground">{user.email}</dd>
          </div>
          <div className="app-surface p-4">
            <dt className="font-medium text-muted-foreground">User ID</dt>
            <dd className="mt-1 break-all text-foreground">{user.id}</dd>
          </div>
        </dl>

        <section className="mt-10 max-w-2xl border-t border-border pt-8">
          <h2 className="text-lg font-semibold text-foreground">Data and privacy</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Review the <Link className="font-semibold text-primary hover:underline" href="/privacy">privacy notice</Link> and <Link className="font-semibold text-primary hover:underline" href="/terms">terms of use</Link>. You can permanently remove your account and associated workspace data here.
          </p>
          <div className="mt-5">
            <DeleteAccountButton />
          </div>
        </section>
      </section>
    </AppShell>
  );
}
