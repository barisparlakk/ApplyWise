import Link from "next/link";

type HealthResponse = {
  status: string;
};

async function getApiHealth(): Promise<string> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return `error (${response.status})`;
    }

    const data = (await response.json()) as HealthResponse;
    return data.status;
  } catch {
    return "unreachable";
  }
}

export default async function Home() {
  const apiStatus = await getApiHealth();
  const isHealthy = apiStatus === "ok";

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          ApplyWise
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-6xl">
          Internship intelligence for computer engineering and data/AI students.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          The MVP scaffold is running with a Next.js frontend, FastAPI backend,
          PostgreSQL with pgvector, Redis, and a worker service.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
            href="/login?callbackUrl=/dashboard"
          >
            Sign in
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-md border border-border bg-white px-5 text-sm font-medium text-foreground"
            href="/dashboard"
          >
            Open dashboard
          </Link>
        </div>
        <div className="mt-8 inline-flex w-fit items-center gap-3 rounded-md border border-border bg-white px-4 py-3 text-sm shadow-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isHealthy ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="font-medium">API health:</span>
          <span className={isHealthy ? "text-emerald-700" : "text-red-700"}>{apiStatus}</span>
        </div>
      </section>
    </main>
  );
}
