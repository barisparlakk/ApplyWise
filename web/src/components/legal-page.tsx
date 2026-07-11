import Link from "next/link";

import { BrandLockup } from "@/components/brand";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalPageProps = {
  title: string;
  introduction: string;
  sections: LegalSection[];
  supportEmail: string;
};

export function LegalPage({
  title,
  introduction,
  sections,
  supportEmail,
}: Readonly<LegalPageProps>) {
  return (
    <main className="min-h-screen bg-[#f5f6f8] px-5 py-8 sm:px-8 sm:py-12">
      <article className="mx-auto w-full max-w-3xl">
        <Link className="inline-flex text-foreground" href="/"><BrandLockup /></Link>
        <p className="mt-10 text-xs font-semibold uppercase text-muted-foreground">
          Last updated July 10, 2026
        </p>
        <h1 className="mt-3 text-4xl font-bold text-foreground sm:text-5xl">{title}</h1>
        <p className="mt-5 text-base leading-8 text-muted-foreground">{introduction}</p>

        <div className="mt-10 space-y-8 border-t border-border pt-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          Questions can be sent to{" "}
          <a className="font-semibold text-primary hover:underline" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          .
        </footer>
      </article>
    </main>
  );
}
