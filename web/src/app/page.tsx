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
    <main className="min-h-screen bg-[#10221f] px-5 py-5 text-white sm:p-8">
      <section className="page-entrance mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#15302b] shadow-2xl sm:min-h-[calc(100vh-64px)]">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d7f75b] text-xs font-bold text-[#10221f]">AW</span>
            <div>
              <p className="font-semibold tracking-wide">ApplyWise</p>
              <p className="text-xs text-[#b7cfc8]">Career intelligence workspace</p>
            </div>
          </div>
          <Link className="text-sm font-semibold text-[#d7f75b] transition hover:text-white" href="/login?callbackUrl=/dashboard">
            Sign in
          </Link>
        </header>

        <div className="grid flex-1 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:px-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a9c1ba]">Internship command center</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
              Make every application a smarter decision.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#c4d7d2] sm:text-lg">
              Assess role fit, organize the pipeline, and focus your preparation where it has the highest impact.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link className="inline-flex h-11 items-center rounded-md bg-[#d7f75b] px-5 text-sm font-semibold text-[#10221f] transition hover:bg-[#e3ff82]" href="/login?callbackUrl=/dashboard">
                Enter workspace
              </Link>
              <Link className="inline-flex h-11 items-center rounded-md border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10" href="/dashboard">
                Open dashboard
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-3 text-sm text-[#b7cfc8]">
              <span className={`h-2 w-2 rounded-full ${isHealthy ? "bg-[#d7f75b]" : "bg-red-400"}`} />
              <span>Workspace services: <strong className="font-semibold text-white">{apiStatus}</strong></span>
            </div>
          </div>

          <div className="relative border-t border-white/10 bg-[#eaf2ef] p-5 text-[#10221f] lg:border-l lg:border-t-0 sm:p-8">
            <div className="absolute right-8 top-8 hidden h-32 w-32 rounded-full border-[18px] border-[#d7f75b] opacity-80 lg:block" />
            <div className="relative mx-auto max-w-xl rounded-lg border border-[#cbded7] bg-white p-5 shadow-[0_24px_60px_rgba(15,38,33,0.16)] sm:p-6">
              <div className="flex items-center justify-between border-b border-[#dce9e4] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5c7d74]">Live workflow</p>
                  <p className="mt-1 text-lg font-semibold">Your opportunity queue</p>
                </div>
                <span className="rounded-md bg-[#e6f2ee] px-2.5 py-1 text-xs font-semibold text-[#16675a]">Focused</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <PreviewMetric label="Fit" value="78%" />
                <PreviewMetric label="Active" value="04" />
                <PreviewMetric label="Gaps" value="03" />
              </div>
              <div className="mt-5 space-y-3">
                <PreviewRow company="Nexa Labs" role="ML Engineering Intern" score="82%" tone="bg-[#d7f75b]" />
                <PreviewRow company="Northstar Data" role="Data Science Intern" score="76%" tone="bg-[#8ed4c2]" />
                <PreviewRow company="LayerWorks" role="Backend Intern" score="69%" tone="bg-[#f3bd6a]" />
              </div>
              <div className="mt-5 rounded-md bg-[#10221f] p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#a9c1ba]">Next best action</p>
                <p className="mt-2 text-sm font-semibold">Rehearse project explanation for your upcoming interview.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PreviewMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="rounded-md border border-[#dce9e4] bg-[#f8fbfa] p-3"><p className="text-xs text-[#5c7d74]">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function PreviewRow({ company, role, score, tone }: Readonly<{ company: string; role: string; score: string; tone: string }>) {
  return <div className="grid grid-cols-[10px_1fr_auto] items-center gap-3 rounded-md border border-[#dce9e4] p-3"><span className={`h-8 rounded-sm ${tone}`} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{company}</p><p className="mt-0.5 truncate text-xs text-[#5c7d74]">{role}</p></div><p className="text-sm font-semibold text-[#16675a]">{score}</p></div>;
}
