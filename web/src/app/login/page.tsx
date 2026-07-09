import { LoginForm } from "@/app/login/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";

  return (
    <main className="grid min-h-screen bg-[#10221f] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#15302b] p-10 text-white lg:flex">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#d7f75b] text-xs font-bold text-[#10221f]">AW</span><span className="font-semibold tracking-wide">ApplyWise</span></div>
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a9c1ba]">Your career workspace</p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08]">Apply with a clearer signal.</h1>
          <p className="mt-6 text-lg leading-8 text-[#c4d7d2]">Bring your CV, projects, roles, and prep work into a single focused workflow.</p>
        </div>
        <p className="text-sm text-[#a9c1ba]">Built for computer engineering and data/AI students.</p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[#f6f9f8] px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><p className="text-lg font-semibold text-foreground">ApplyWise</p><p className="mt-1 text-sm text-muted-foreground">Career intelligence workspace</p></div>
          <p className="app-kicker">Welcome back</p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground">Sign in to your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Use the demo email to explore the seeded workspace, or continue with GitHub.</p>
          <div className="mt-8 app-surface p-5 sm:p-6"><LoginForm callbackUrl={callbackUrl} /></div>
        </div>
      </section>
    </main>
  );
}
