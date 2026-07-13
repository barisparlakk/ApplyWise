import {
  ArrowRight,
  FileText,
  Fingerprint,
  GitFork,
  LockKeyhole,
  Mail,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountButton } from "@/app/settings/delete-account-button";
import { ExportDataButton } from "@/app/settings/export-data-button";
import { SignOutButton } from "@/app/settings/sign-out-button";
import { AppShell } from "@/components/app-shell";
import { Reveal } from "@/components/motion";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { SignalField } from "@/components/signal-field";
import { getCurrentUser } from "@/lib/api";
import { getBackendSession } from "@/lib/server-auth";
import { getTranslations } from "@/lib/server-i18n";

export default async function SettingsPage() {
  const session = await getBackendSession();

  if (!session) {
    redirect("/login?callbackUrl=/settings");
  }

  const user = await getCurrentUser(session);
  const t = await getTranslations();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1200px] space-y-6">
        <PageHeader
          action={<SignOutButton />}
          description={t("Manage account identity, session access, and the evidence stored in your workspace.")}
          eyebrow={t("Workspace controls")}
          icon={Settings}
          title={t("Account settings")}
        />

        <Reveal className="relative overflow-hidden rounded-lg bg-[#101318] text-white shadow-[0_20px_46px_rgba(16,19,24,0.14)]">
          <SignalField className="left-auto w-[48%] opacity-45" compact />
          <div className="relative flex min-h-[210px] flex-col justify-between gap-7 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-white/[0.12] bg-white/[0.08] text-xl font-bold text-[#FF786D]">{initials(user.full_name ?? user.email)}</span>
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase text-[#2BC3CE]">{t("Active account")}</p><h2 className="mt-2 truncate text-2xl font-bold">{user.full_name ?? t("ApplyWise user")}</h2><p className="mt-1 truncate text-sm text-white/[0.52]">{user.email}</p></div>
            </div>
            <div className="border-t border-white/[0.10] pt-5 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0"><p className="text-[10px] font-bold uppercase text-white/[0.38]">{t("Account ID")}</p><p className="mt-2 max-w-[280px] break-all font-mono text-xs leading-5 text-white/[0.62]">{user.id}</p></div>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Reveal className="app-surface overflow-hidden" delay={0.04}>
            <div className="border-b border-border p-5 sm:p-6"><SectionHeading description={t("Identity shared with your private ApplyWise workspace.")} title={t("Account identity")} /></div>
            <dl className="divide-y divide-border">
              <IdentityRow icon={UserRound} label={t("Name")} value={user.full_name ?? t("Not set")} />
              <IdentityRow icon={Mail} label={t("Email")} value={user.email} />
              <IdentityRow icon={Fingerprint} label={t("User ID")} value={user.id} />
            </dl>
          </Reveal>

          <Reveal className="app-surface overflow-hidden" delay={0.08}>
            <div className="border-b border-border p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#D9473F]"><ShieldCheck className="h-4 w-4" />{t("Evidence controls")}</div></div>
            <div className="divide-y divide-border">
              <SettingsLink href="/profile" icon={UserRound} label={t("Profile evidence")} />
              <SettingsLink href="/resume" icon={FileText} label={t("CV library")} />
              <SettingsLink href="/projects" icon={GitFork} label={t("Repository evidence")} />
            </div>
          </Reveal>
        </div>

        <Reveal className="grid border-y border-border bg-white lg:grid-cols-[240px_1fr]" delay={0.1}>
          <div className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r"><div className="flex items-center gap-2 text-xs font-bold uppercase text-[#167D87]"><LockKeyhole className="h-4 w-4" />{t("Data and privacy")}</div><p className="mt-3 text-sm leading-6 text-muted-foreground">{t("Your evidence remains tied to your account.")}</p></div>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><p className="max-w-2xl text-sm leading-7 text-muted-foreground">{t("Review the")} <Link className="font-bold text-[#D9473F] hover:text-foreground" href="/privacy">{t("privacy notice link")}</Link> {t("and")} <Link className="font-bold text-[#D9473F] hover:text-foreground" href="/terms">{t("terms of use link")}</Link> {t("for details on storage, processing, and deletion.")}</p><ExportDataButton /></div>
        </Reveal>

        <Reveal className="border-l-2 border-[#FF5A4E] bg-[#fff5f4] p-5 sm:p-6" delay={0.14}>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div><p className="text-xs font-bold uppercase text-[#A63832]">{t("Danger zone")}</p><h2 className="mt-2 text-lg font-bold text-foreground">{t("Delete workspace and account")}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("Permanently removes your profile, CVs, repository analyses, roles, applications, roadmaps, and interview preparation.")}</p></div>
            <DeleteAccountButton />
          </div>
        </Reveal>
      </div>
    </AppShell>
  );
}

function IdentityRow({ icon: Icon, label, value }: Readonly<{ icon: LucideIcon; label: string; value: string }>) {
  return <div className="grid gap-2 px-5 py-4 sm:grid-cols-[150px_1fr] sm:items-center sm:px-6"><dt className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground"><Icon className="h-4 w-4 text-[#D9473F]" />{label}</dt><dd className="break-all text-sm font-semibold text-foreground">{value}</dd></div>;
}

function SettingsLink({ href, icon: Icon, label }: Readonly<{ href: string; icon: LucideIcon; label: string }>) {
  return <Link className="group flex items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-foreground transition hover:bg-[#f8f9fa] hover:text-[#D9473F]" href={href}><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground group-hover:text-[#D9473F]" />{label}</span><ArrowRight className="h-4 w-4" /></Link>;
}

function initials(value: string) {
  return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AW";
}
