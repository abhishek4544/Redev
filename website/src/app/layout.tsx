import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "redev — click your UI into code",
  description:
    "Redev turns any local dev app into an editable surface. Hover for exact visual context, click an element, describe the change, and let your coding agent edit the source.",
  openGraph: {
    title: "redev — click your UI into code",
    description:
      "One command. Any local app. Hover a UI element for its styles, click it, and let your coding agent fix the source.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
