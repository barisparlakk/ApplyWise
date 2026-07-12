"use client";

import { createContext, useCallback, useContext } from "react";

import type { Locale, TranslationValues } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  children,
  locale,
}: Readonly<{
  children: React.ReactNode;
  locale: Locale;
}>) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext);

  if (!locale) {
    throw new Error("useLocale must be used within LocaleProvider.");
  }

  return locale;
}

export function useTranslations() {
  const locale = useLocale();
  return useCallback(
    (message: string, values?: TranslationValues) => translate(locale, message, values),
    [locale],
  );
}
