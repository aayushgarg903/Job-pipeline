import type { Lang } from "@ks/contracts";
import { formatNumber } from "@ks/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { getReaders } from "@/lib/readers";
import { routes } from "@/lib/routes";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { HeroClient } from "@/components/HeroClient";

async function HomeBody() {
  const [t, locale, readers] = await Promise.all([getTranslations(), getLocale(), getReaders()]);
  const lang = (locale === "mr" ? "mr" : "en") as Lang;
  const o = await readers.stateOverview();

  const personas = [
    { key: "official", title: "District Official", name: t("home.official.name"), href: routes.state(), cta: t("home.official.cta"), icon: "🏢" },
    { key: "institute", title: "Training Institute", name: t("home.institute.name"), href: routes.radar(), cta: t("home.institute.cta"), icon: "🏫" },
    { key: "employer", title: "Local Employer", name: t("home.employer.name"), href: routes.employer(), cta: t("home.employer.cta"), icon: "🏭" },
    { key: "candidate", title: "Job Seeker", name: t("home.candidate.name"), href: routes.me(), cta: t("home.candidate.cta"), icon: "👩‍🎓" },
  ];

  return (
    <HeroClient 
      personas={personas} 
      stats={{ 
        postings: formatNumber(o.postingsThisQuarter, lang), 
        employers: o.employersHeard, 
        districts: formatNumber(o.districts, lang) 
      }} 
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton cards={4} />}>
      <HomeBody />
    </Suspense>
  );
}
