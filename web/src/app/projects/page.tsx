import { redirect } from "next/navigation";

import { GitHubAnalyzer } from "@/app/projects/github-analyzer";
import { AppShell } from "@/components/app-shell";
import { getGitHubRepositories } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";

export default async function ProjectsPage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/projects");
  }

  const repositories = await getGitHubRepositories(session);

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-7xl">
        <GitHubAnalyzer
          apiBaseUrl={process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend"}
          initialRepositories={repositories}
        />
      </section>
    </AppShell>
  );
}
