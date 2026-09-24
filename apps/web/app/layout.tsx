// Root layout. The shell (html, bilingual GIGW strip, skip link) is static; the translated
// part reads the locale cookie and so lives inside <Suspense> (Cache Components rule).
// <html lang>/data-theme are applied before paint by an inline script (Next's documented
// pattern for cookie-driven <html> attributes), then kept in sync by LocaleShell.
import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { PREFS_BOOT_SCRIPT } from "@ks/ui";
import { GovStrip } from "@/components/GovStrip";
import { LocaleShell, ShellFallback } from "@/components/LocaleShell";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kaushal Setu · कौशल्य सेतू", template: "%s · Kaushal Setu" },
  description: "Where Maharashtra's training meets its jobs. महाराष्ट्रातील प्रशिक्षण आणि रोजगार यांना जोडणारा सेतू.",
  applicationName: "Kaushal Setu",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#CFC8B8" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="ks-skip" href="#main">
          Skip to main content · <span lang="mr">मुख्य मजकुराकडे जा</span>
        </a>
        <GovStrip />
        <Suspense fallback={<ShellFallback />}>
          <LocaleShell>{children}</LocaleShell>
        </Suspense>
      </body>
    </html>
  );
}
