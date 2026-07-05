import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/api";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const user = await getCurrentUser(session);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              Welcome back, {user.full_name ?? user.email}.
            </h1>
          </div>
          <Link
            className="h-10 rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-foreground"
            href="/profile"
          >
            Profile
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Applications</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">0</p>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Fit analyses</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">0</p>
          </div>
          <div className="rounded-md border border-border bg-white p-4">
            <p className="text-sm font-medium text-muted-foreground">Roadmap items</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">0</p>
          </div>
        </div>
      </section>
    </main>
  );
}
