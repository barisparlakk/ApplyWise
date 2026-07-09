import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/app/settings/sign-out-button";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/api";
import { authOptions } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

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
      </section>
    </AppShell>
  );
}
