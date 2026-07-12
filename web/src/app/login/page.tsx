import { Activity, ArrowUpRight, CircleCheck, Radar } from "lucide-react";

import { LoginForm } from "@/app/login/login-form";
import { BrandLockup, BrandMark } from "@/components/brand";
import { SignalField } from "@/components/signal-field";
import { emailLoginEnabled, githubLoginEnabled, googleLoginEnabled } from "@/lib/auth";
import { getTranslations } from "@/lib/server-i18n";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const destination = safeCallbackUrl(params.callbackUrl);
  const callbackUrl = `/start?next=${encodeURIComponent(destination)}`;
  const t = await getTranslations();

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#101318] text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <SignalField />
        <div className="relative z-10">
          <BrandLockup />
        </div>

        <div className="relative z-10 max-w-2xl pb-4">
          <BrandMark animated className="h-16 w-16" />
          <h1 className="mt-7 text-6xl font-bold leading-none xl:text-7xl">ApplyWise</h1>
          <p className="mt-5 max-w-xl text-xl leading-8 text-white/[0.72]">{t("Turn your evidence into clearer internship decisions.")}</p>
          <div className="mt-10 grid max-w-xl grid-cols-3 border-y border-white/[0.12] py-5">
            <SignalStat icon={Radar} label={t("Role fit")} value={t("7 signals")} />
            <SignalStat icon={Activity} label={t("Next move")} value={t("Prioritized")} />
            <SignalStat icon={CircleCheck} label={t("Evidence")} value={t("Grounded")} />
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-white/[0.42]">
          <span>{t("Career signal system")}</span>
          <span className="flex items-center gap-1.5">{t("Built for early-career engineers")} <ArrowUpRight className="h-3.5 w-3.5" /></span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-5 py-10 sm:px-10 lg:px-12">
        <div className="page-entrance w-full max-w-[430px]">
          <div className="mb-12 flex items-center justify-between lg:hidden">
            <BrandLockup />
            <span className="signal-chip">{t("Signal OS")}</span>
          </div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-[#a63832]"><span className="h-1.5 w-1.5 rounded-full bg-[#FF5A4E]" /> {t("Workspace access")}</p>
          <h2 className="mt-4 text-3xl font-bold text-foreground">{t("Continue to your workspace")}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("Your roles, evidence, applications, and preparation stay connected in one place.")}</p>

          <div className="mt-9 border-t border-border pt-7">
            <LoginForm
              callbackUrl={callbackUrl}
              emailEnabled={emailLoginEnabled}
              githubEnabled={githubLoginEnabled}
              googleEnabled={googleLoginEnabled}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function SignalStat({ icon: Icon, label, value }: { icon: typeof Radar; label: string; value: string }) {
  return (
    <div className="border-r border-white/[0.12] px-4 first:pl-0 last:border-r-0">
      <Icon className="h-4 w-4 text-[#2BC3CE]" />
      <p className="mt-3 text-xs text-white/[0.45]">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function safeCallbackUrl(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}
