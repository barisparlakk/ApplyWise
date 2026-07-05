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
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          ApplyWise
        </p>
        <h1 className="mb-8 max-w-2xl text-4xl font-semibold leading-tight text-foreground">
          Sign in to continue.
        </h1>
        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
