// /employer/prs/[id]: one Curriculum PR in full (every diff line, trainer and equipment needs)
// with the review form and a comment box.
import type { Lang } from "@ks/contracts";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PrCard } from "@/components/public/PrCard";
import { loadPrViews } from "@/components/public/pr-data";
import { getReaders } from "@/lib/readers";

export const metadata: Metadata = { title: "Review a course change · अभ्यासक्रम बदल तपासा" };

async function PrBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, locale, readers] = await Promise.all([getTranslations("public"), getLocale(), getReaders()]);
  const lang = (locale === "mr" ? "mr" : "en") as Lang;
  const pr = /^[\w-]{1,80}$/.test(id) ? await readers.pr(id) : null;
  if (!pr) notFound();
  const [view] = await loadPrViews([pr], lang);

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <nav>
        <Link href="/employer/prs" className="ks-btn ks-btn--ghost min-h-11">
          <span aria-hidden="true">← </span>
          {t("prs.back")}
        </Link>
      </nav>
      <p className="m-0 text-sm text-table-muted">{t("demo.employer")}</p>
      {view ? <PrCard {...view} lang={lang} detail headingLevel={2} /> : null}
    </div>
  );
}

export default function PrPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton cards={1} variant="pr" />}>
      <PrBody params={params} />
    </Suspense>
  );
}
