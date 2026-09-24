// /employer: a warm intro, the demand survey (<= 6 minutes), and a way into the Curriculum
// PR inbox. The body reads the locale, so it renders inside its own <Suspense>.
import type { Lang } from "@ks/contracts";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SurveyForm } from "@/components/public/SurveyForm";
import { getReaders } from "@/lib/readers";
import { DEMO_EMPLOYER_ID, writersAreDemo } from "@/lib/writers";

export const metadata: Metadata = { title: "Employer survey · उद्योजक सर्वेक्षण" };

async function EmployerBody() {
  const [t, locale, readers] = await Promise.all([getTranslations("public"), getLocale(), getReaders()]);
  const lang = (locale === "mr" ? "mr" : "en") as Lang;
  const [districts, skills, inbox, demo] = await Promise.all([
    readers.districts(),
    readers.searchSkills("", 500),
    readers.employerInbox(DEMO_EMPLOYER_ID),
    writersAreDemo(),
  ]);
  const options = districts
    .map((d) => ({ lgd: d.district.lgd, name: lang === "mr" ? d.district.nameMr : d.district.nameEn }))
    .sort((a, b) => a.name.localeCompare(b.name, lang === "mr" ? "mr" : "en"));

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="ks-page-head m-0">
        <p className="ks-mono m-0 text-sm text-table-muted">{t("employer.code")}</p>
        <h1 className="ks-page-title">{t("employer.title")}</h1>
        <p className="ks-page-lede">{t("employer.lede")}</p>
        <p className="m-0 max-w-[62ch] text-table-muted">{t("employer.why")}</p>
        {demo ? <p className="m-0 text-sm text-table-muted">{t("demo.writes")}</p> : null}
      </header>

      <SurveyForm districts={options} catalog={skills.map(({ id, labelEn, labelMr }) => ({ id, labelEn, labelMr }))} />

      <section aria-labelledby="inbox-heading" className="ks-stock grid gap-3 p-5">
        <h2 id="inbox-heading" className="ks-section__title m-0">
          {t("employer.inboxTitle")}
        </h2>
        <p className="m-0">{t("employer.inboxBody")}</p>
        <p className="m-0 text-ink-muted">{t("prs.count", { n: inbox.length })}</p>
        <div>
          <Link href="/employer/prs" className="ks-btn ks-btn--secondary">
            {t("employer.inboxCta")}
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function EmployerPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={1} variant="employer" />}>
      <EmployerBody />
    </Suspense>
  );
}
