import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyWise",
  description: "Internship intelligence for computer engineering and data/AI students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
