import "server-only";

import { headers } from "next/headers";

import { createTranslator, resolveLocale } from "@/lib/i18n";

export async function getRequestLocale() {
  const requestHeaders = await headers();
  return resolveLocale(requestHeaders.get("accept-language"));
}

export async function getTranslations() {
  return createTranslator(await getRequestLocale());
}
