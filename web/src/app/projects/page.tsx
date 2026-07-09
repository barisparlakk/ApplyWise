import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { GitHubAnalyzer } from "@/app/projects/github-analyzer";
import { AppShell } from "@/components/app-shell";
import { getGitHubRepositories } from "@/lib/api";
import { authOptions } from "@/lib/auth";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    redirect("/login?callbackUrl=/projects");
  }

  const repositories = await getGitHubRepositories(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <GitHubAnalyzer
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}
          backendToken={session.backendToken}
          initialRepositories={repositories}
        />
      </section>
    </AppShell>
  );
}
