"use client";

import { SessionProvider } from "next-auth/react";

import { LocaleProvider } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

export function Providers({
  children,
  locale,
}: Readonly<{
  children: React.ReactNode;
  locale: Locale;
}>) {
  return (
    <LocaleProvider locale={locale}>
      <SessionProvider>{children}</SessionProvider>
    </LocaleProvider>
  );
}
