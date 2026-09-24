// /employer/prs: the Curriculum PR inbox for one employer. There is no employer login yet, so
// every visitor reviews as the demo employer (labelled on the page).
import type { Lang } from "@ks/contracts";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PrCard } from "@/components/public/PrCard";
import { loadPrViews } from "@/components/public/pr-data";
import { getReaders } from "@/lib/readers";
import { DEMO_EMPLOYER_ID } from "@/lib/writers";

export const metadata: Metadata = { title: "Course changes to review · तपासायचे बदल" };

async function InboxBody() {
  const [t, locale, readers] = await Promise.all([getTranslations("public"), getLocale(), getReaders()]);
  const lang = (locale === "mr" ? "mr" : "en") as Lang;
  const views = await loadPrViews(await readers.employerInbox(DEMO_EMPLOYER_ID), lang);

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header className="ks-page-head m-0">
        <h1 className="ks-page-title">{t("prs.title")}</h1>
        <p className="ks-page-lede">{t("prs.lede")}</p>
        <p className="m-0 text-table-muted">{views.length ? t("prs.count", { n: views.length }) : t("prs.empty")}</p>
        <p className="m-0 text-sm text-table-muted">{t("demo.employer")}</p>
      </header>
      <ol className="m-0 grid list-none gap-8 p-0">
        {views.map((v) => (
          <li key={v.pr.id}>
            <PrCard {...v} lang={lang} detail={false} />
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function PrInboxPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={2} variant="pr" />}>
      <InboxBody />
    </Suspense>
  );
}
