import type { Lang } from "@ks/contracts";
import { FreshnessStrip, formatDate } from "@ks/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { getReaders } from "@/lib/readers";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";

async function LastUpdatedPageBody() {
  const [t, locale, r] = await Promise.all([getTranslations(), getLocale(), getReaders()]);
  const lang = (locale === "mr" ? "mr" : "en") as Lang;
  const [sources, overview] = await Promise.all([r.sources(), r.stateOverview()]);
  return (
    <article>
      <header className="ks-page-head">
        <h1 className="ks-page-title">{t("pages.lastUpdated.title")}</h1>
        <p className="ks-page-lede">{t("pages.lastUpdated.lede")}</p>
        <p className="m-0">{t("pages.lastUpdated.overview", { date: formatDate(overview.asOf, lang) })}</p>
      </header>
      <FreshnessStrip sources={sources} lang={lang} labels={t.raw("fresh") as Record<string, string>} />
    </article>
  );
}

export default function LastUpdatedPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={1} />}>
      <LastUpdatedPageBody />
    </Suspense>
  );
}
