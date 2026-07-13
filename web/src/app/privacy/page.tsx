import { LegalPage } from "@/components/legal-page";
import { getTranslations } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Information we store",
    paragraphs: [
      "ApplyWise stores the identity details supplied by your sign-in provider, profile and education details, CV text and extracted sections, selected GitHub repository metadata, job descriptions, application tracking data, fit analyses, learning plans, and interview preparation content.",
      "GitHub access tokens remain inside the encrypted authentication session and are used only to request repository information you ask ApplyWise to analyze. They are not stored in the ApplyWise product database.",
    ],
  },
  {
    title: "How information is used",
    paragraphs: [
      "We use your information to provide role analysis, deterministic fit scoring, profile feedback, roadmaps, application tracking, and interview preparation.",
      "When an AI-backed feature is enabled, the minimum relevant CV, profile, repository, or job context is sent to the configured AI provider to produce that result. ApplyWise does not sell personal information or use uploaded career data for advertising.",
    ],
  },
  {
    title: "Retention and deletion",
    paragraphs: [
      "Your live account data remains available until you delete the account from Settings. Account deletion removes the associated product records. Encrypted infrastructure backups may retain deleted records until the operator's normal backup rotation expires.",
      "You can export a machine-readable copy of your ApplyWise workspace from Settings before deleting the account.",
      "Do not upload secrets, confidential employer information, or personal data belonging to someone else.",
    ],
  },
  {
    title: "Security and service providers",
    paragraphs: [
      "ApplyWise uses access controls, encrypted transport, private service networking, bounded uploads, and short-lived backend credentials. No online service can promise absolute security.",
      "The free beta uses Render for hosting and temporary queue storage, Neon for PostgreSQL, Google or GitHub for sign-in, GitHub for repository metadata, and Cloudflare Workers AI for configured AI and embedding operations.",
    ],
  },
];

export default async function PrivacyPage() {
  const t = await getTranslations();

  return (
    <LegalPage
      introduction={t("This notice explains what ApplyWise handles when you use the career intelligence workspace and the controls available to you.")}
      sections={sections.map((section) => ({
        paragraphs: section.paragraphs.map((paragraph) => t(paragraph)),
        title: t(section.title),
      }))}
      supportEmail={process.env.SUPPORT_EMAIL ?? "support@applywise.local"}
      title={t("Privacy notice")}
    />
  );
}
