import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { getRequestLocale } from "@/lib/server-i18n";
import { translate } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return {
    title: {
      default: "ApplyWise",
      template: "%s | ApplyWise",
    },
    description: translate(
      locale,
      "Internship intelligence for computer engineering and data/AI students.",
    ),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
