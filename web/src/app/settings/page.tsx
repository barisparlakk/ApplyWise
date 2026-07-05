import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/app/settings/sign-out-button";
import { getCurrentUser } from "@/lib/api";
import { authOptions } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/settings");
  }

  const user = await getCurrentUser(session);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Settings
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Account</h1>
          </div>
          <SignOutButton />
        </div>

        <dl className="mt-10 grid max-w-xl gap-4 text-sm">
          <div className="rounded-md border border-border bg-white p-4">
            <dt className="font-medium text-muted-foreground">Name</dt>
            <dd className="mt-1 text-foreground">{user.full_name ?? "Not set"}</dd>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <dt className="font-medium text-muted-foreground">Email</dt>
            <dd className="mt-1 text-foreground">{user.email}</dd>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <dt className="font-medium text-muted-foreground">User ID</dt>
            <dd className="mt-1 break-all text-foreground">{user.id}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
