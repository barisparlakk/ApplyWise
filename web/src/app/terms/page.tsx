import { LegalPage } from "@/components/legal-page";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "What ApplyWise provides",
    paragraphs: [
      "ApplyWise provides career organization, fit analysis, and preparation tools. Scores and AI-generated suggestions are informational signals, not promises of employment, interview success, or admission to any program.",
      "You remain responsible for reviewing every output and deciding what to submit to an employer.",
    ],
  },
  {
    title: "Your responsibilities",
    paragraphs: [
      "Use the service lawfully and only with content you are entitled to provide. Do not upload malware, secrets, confidential third-party information, or content intended to interfere with the service.",
      "You are responsible for your sign-in account and for the accuracy of information you submit to employers.",
    ],
  },
  {
    title: "Availability and changes",
    paragraphs: [
      "Features may change as the product develops, and temporary interruptions may occur for maintenance, provider outages, or security reasons. Usage controls may limit expensive analysis actions to keep the service reliable for all users.",
      "We may suspend abusive use or activity that risks other users, the service, or its providers.",
    ],
  },
  {
    title: "Your content and account",
    paragraphs: [
      "You retain ownership of the content you provide. You give ApplyWise permission to process it only as needed to operate the requested features.",
      "You can stop using the service and delete your product data from Settings at any time.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      introduction="These terms set the practical rules for using ApplyWise as a public career intelligence service."
      sections={sections}
      supportEmail={process.env.SUPPORT_EMAIL ?? "support@applywise.local"}
      title="Terms of use"
    />
  );
}
