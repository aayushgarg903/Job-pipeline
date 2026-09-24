// The translated shell: top bar, rail, main, footer, compare tray. Reads the locale (cookie /
// Accept-Language), so the root layout renders it inside <Suspense>. Never inside "use cache".
import type { Lang } from "@ks/contracts";
import { SkeletonCard } from "@ks/ui";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { navGroups } from "@/lib/nav";
import { AppProviders, NavRail, TopTools } from "./ShellClient";
import { SiteFooter } from "./SiteFooter";
import { UiLink } from "@ks/ui";

export async function LocaleShell({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as Lang;
  const messages = await getMessages();
  const t = await getTranslations();
  const groups = navGroups((k) => t(`nav.${k}`));

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* Keeps <html lang> right when the locale came from Accept-Language, not the cookie. */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};` }} />
      <AppProviders
        compareLabels={{ placed: t.raw("compare.placed"), removed: t.raw("compare.removed"), full: t.raw("compare.full") }}
        trayLabels={t.raw("tray") as Record<string, string>}
        tableLabels={t.raw("compareTable") as Record<string, string>}
      >
        <header className="ks-topbar">
          <UiLink href="/" className="ks-brand">
            <span className="ks-brand__name">{t("shell.brand")}</span>
            <span className="ks-brand__mr" lang="mr">कौशल्य सेतू</span>
          </UiLink>
          <TopTools
            locale={locale}
            groups={groups}
            labels={{
              menu: t("shell.menu"), closeMenu: t("shell.closeMenu"), nav: t("shell.navLabel"), language: t("shell.language"),
              theme: { group: t("shell.theme.group"), daylight: t("shell.theme.daylight"), boardroom: t("shell.theme.boardroom") },
            }}
          />
        </header>
        <div className="ks-shell">
          <NavRail groups={groups} label={t("shell.navLabel")} />
          <main id="main" className="ks-main" tabIndex={-1}>
            {children}
          </main>
        </div>
        <SiteFooter />
      </AppProviders>
    </NextIntlClientProvider>
  );
}

/** Static fallback while the locale-bound shell streams in: reserves the layout, no copy. */
export function ShellFallback() {
  return (
    <div className="ks-shell" aria-busy="true">
      <div className="ks-rail" aria-hidden="true" />
      <main id="main" className="ks-main">
        <div className="ks-card-grid">
          <SkeletonCard variant="district" label="Loading · उघडत आहे" />
          <SkeletonCard variant="skill" />
          <SkeletonCard variant="course" />
        </div>
      </main>
    </div>
  );
}
