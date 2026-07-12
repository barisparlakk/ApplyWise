import {
  ArrowRight,
  Check,
  CircleCheck,
  Gauge,
  GitBranch,
  Radar,
  Route,
  ScanSearch,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";

import { BrandLockup, BrandMark } from "@/components/brand";
import { MotionBar, Reveal } from "@/components/motion";
import { SignalField } from "@/components/signal-field";

type HealthResponse = { status: string };

async function getApiHealth(): Promise<string> {
  const baseUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
    if (!response.ok) return `error (${response.status})`;
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
    <main className="min-h-screen bg-[#f5f6f8] text-foreground">
      <section className="relative flex min-h-[82svh] flex-col overflow-hidden bg-[#101318] text-white">
        <SignalField className="opacity-85" />
        <header className="relative z-10 border-b border-white/[0.10]">
          <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between px-5 sm:px-8">
            <BrandLockup />
            <div className="flex items-center gap-2">
              <Link className="motion-control hidden h-10 items-center px-3 text-sm font-bold text-white/[0.68] hover:text-white sm:inline-flex" href="/login?callbackUrl=/dashboard">Sign in</Link>
              <Link className="motion-control inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-bold text-[#101318] hover:bg-[#f0f1f3]" href="/login?callbackUrl=/dashboard">Enter workspace <ArrowRight className="h-4 w-4 text-[#D9473F]" /></Link>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-5 py-12 sm:px-8 lg:py-16">
          <BrandMark animated className="h-14 w-14" />
          <p className="mt-6 flex items-center gap-2 text-xs font-bold uppercase text-[#FF786D]"><span className="h-1.5 w-1.5 rounded-full bg-[#FF5A4E]" />Internship intelligence system</p>
          <h1 className="mt-4 max-w-5xl text-6xl font-bold leading-none sm:text-7xl lg:text-8xl">ApplyWise</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/[0.68] sm:text-xl">Know which roles fit, what evidence is missing, and the exact next move before you spend another application.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="motion-control inline-flex h-11 items-center gap-2 rounded-md bg-[#FF5A4E] px-5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(255,90,78,0.22)] hover:bg-[#D9473F]" href="/login?callbackUrl=/dashboard"><Sparkles className="h-4 w-4" />Start free beta</Link>
            <a className="motion-control inline-flex h-11 items-center gap-2 rounded-md border border-white/[0.16] bg-white/[0.07] px-5 text-sm font-bold text-white hover:bg-white/[0.12]" href="#product"><ScanSearch className="h-4 w-4 text-[#2BC3CE]" />See the workflow</a>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/[0.10]">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-2 px-5 sm:grid-cols-4 sm:px-8">
            <HeroMetric icon={Radar} label="Fit model" value="7 deterministic signals" />
            <HeroMetric icon={Target} label="Decision" value="Next action prioritized" />
            <HeroMetric icon={GitBranch} label="Evidence" value="CV + profile + repos" />
            <HeroMetric icon={CircleCheck} label="Services" value={isHealthy ? "Operational" : apiStatus} tone={isHealthy ? "healthy" : "error"} />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white py-16 sm:py-20" id="product">
        <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
          <Reveal className="grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:items-center">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><Gauge className="h-4 w-4" />Decision trace</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">See the reason behind every recommendation.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">ApplyWise separates deterministic scoring from qualitative AI feedback, then converts the biggest gaps into dated work.</p>
              <ul className="mt-6 space-y-3 text-sm text-[#4d545e]">
                {["Fixed weighted score across seven components", "Evidence grounded in your CV, profile, and repositories", "Role-specific roadmap and interview preparation"].map((item) => <li className="flex items-start gap-2" key={item}><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#167D87]" />{item}</li>)}
              </ul>
            </div>
            <ProductPreview />
          </Reveal>
        </div>
      </section>

      <section className="bg-[#f5f6f8] py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase text-[#D9473F]">One connected workflow</p><h2 className="mt-4 text-3xl font-bold sm:text-4xl">From target role to interview room.</h2></div>
          <div className="mt-10 grid border-y border-border bg-white md:grid-cols-3">
            <WorkflowStep icon={ScanSearch} index="01" text="Paste the role and extract requirements, expectations, difficulty, and domain." title="Understand the target" />
            <WorkflowStep icon={Gauge} index="02" text="Compare deterministic fit components against your actual candidate evidence." title="Make the decision" />
            <WorkflowStep icon={Route} index="03" text="Track the application and prepare the missing skills and likely interview angles." title="Close the gaps" />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#101318] py-16 text-white sm:py-20">
        <SignalField className="left-auto w-[52%] opacity-40" compact />
        <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-7 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase text-[#2BC3CE]">Free beta</p><h2 className="mt-4 max-w-2xl text-3xl font-bold sm:text-4xl">Build a clearer internship strategy with your own evidence.</h2></div>
          <Link className="motion-control inline-flex h-11 w-fit items-center gap-2 rounded-md bg-[#FF5A4E] px-5 text-sm font-bold text-white hover:bg-[#D9473F]" href="/login?callbackUrl=/dashboard">Create your workspace <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="text-foreground"><BrandLockup /></div>
          <div className="flex gap-5"><Link className="font-semibold hover:text-foreground" href="/privacy">Privacy</Link><Link className="font-semibold hover:text-foreground" href="/terms">Terms</Link><Link className="font-semibold hover:text-foreground" href="/login?callbackUrl=/dashboard">Sign in</Link></div>
        </div>
      </footer>
    </main>
  );
}

function HeroMetric({ icon: Icon, label, tone = "default", value }: Readonly<{ icon: typeof Radar; label: string; tone?: "default" | "healthy" | "error"; value: string }>) {
  return <div className="border-b border-r border-white/[0.10] py-4 pr-4 even:border-r-0 sm:border-b-0 sm:px-4 sm:first:pl-0 sm:even:border-r sm:last:border-r-0"><Icon className={tone === "error" ? "h-4 w-4 text-[#FF5A4E]" : "h-4 w-4 text-[#2BC3CE]"} /><p className="mt-2 text-[10px] font-bold uppercase text-white/[0.35]">{label}</p><p className="mt-1 text-xs font-bold text-white/[0.72]">{value}</p></div>;
}

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#cfd3d8] bg-[#f8f9fa] shadow-[0_22px_50px_rgba(16,19,24,0.12)]">
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3"><div className="flex items-center gap-2"><BrandMark className="h-7 w-7" /><span className="text-xs font-bold text-foreground">Role intelligence / ML Engineering Intern</span></div><span className="signal-chip">Live decision</span></div>
      <div className="grid lg:grid-cols-[1fr_250px]">
        <div className="p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase text-[#D9473F]">Deterministic fit</p><p className="mt-2 text-4xl font-bold text-foreground">78%</p></div><p className="max-w-xs text-right text-xs leading-5 text-muted-foreground">Apply after strengthening one project evidence gap.</p></div>
          <div className="mt-6 space-y-4"><PreviewScore label="Skill match" value={84} /><PreviewScore label="Project relevance" value={63} /><PreviewScore label="Experience" value={76} /><PreviewScore label="Profile quality" value={82} /></div>
        </div>
        <div className="border-t border-border bg-[#101318] p-5 text-white lg:border-l lg:border-t-0">
          <p className="text-[10px] font-bold uppercase text-[#2BC3CE]">Next action</p><p className="mt-3 text-sm font-bold leading-6">Add evaluation metrics and deployment notes to your strongest ML project.</p>
          <div className="mt-6 border-t border-white/[0.10] pt-4"><p className="text-[10px] font-bold uppercase text-white/[0.35]">Highest-impact gap</p><p className="mt-2 text-sm font-semibold text-white/[0.72]">Model evaluation</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.10]"><MotionBar className="bg-[#FF5A4E]" value={88} /></div></div>
        </div>
      </div>
    </div>
  );
}

function PreviewScore({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div><div className="flex items-center justify-between text-xs"><span className="font-semibold text-[#4d545e]">{label}</span><span className="font-bold text-foreground">{value}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7eaee]"><MotionBar className={value >= 75 ? "bg-[#2BC3CE]" : "bg-[#F0A13A]"} value={value} /></div></div>;
}

function WorkflowStep({ icon: Icon, index, text, title }: Readonly<{ icon: typeof ScanSearch; index: string; text: string; title: string }>) {
  return <Reveal className="border-b border-border p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 sm:p-8"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#D9473F]" /><span className="text-xs font-bold text-muted-foreground">{index}</span></div><h3 className="mt-8 text-lg font-bold text-foreground">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></Reveal>;
}
