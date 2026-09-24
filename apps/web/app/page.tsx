// Landing: the Card Case. One warm introduction card with one humane number, then four
// persona cards ("I am a…"), arrow-key navigable. Entry motion is subtle and off under
// reduced motion. The body reads the locale, so it renders inside its own <Suspense>.
import type { Lang } from "@ks/contracts";
import { Card, CardCase, GatewayCard, PeopleFigure, formatNumber } from "@ks/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { getReaders } from "@/lib/readers";
import { routes } from "@/lib/routes";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/PageSkeleton";

const PERSONAS = [
  { key: "official", variant: "district", href: routes.state() },
  { key: "institute", variant: "course", href: routes.radar() },
  { key: "employer", variant: "employer", href: routes.employer() },
  { key: "candidate", variant: "candidate", href: routes.me() },
] as const;

async function HomeBody() {
  const [t, locale, readers] = await Promise.all([getTranslations(), getLocale(), getReaders()]);
  const lang = (locale === "mr" ? "mr" : "en") as Lang;
  const o = await readers.stateOverview();

  return (
    <>
      <section className="mx-auto mb-12 max-w-3xl">
        <Card
          variant="district"
          code={t("home.introCode")}
          name={t("home.introName")}
          title={t("home.introTitle")}
          human={t("home.introBody")}
          headingLevel={1}
          lang={lang}
          labels={{ asOf: t("card.asOf"), specimen: t("card.specimen"), specimenWord: t("card.specimenWord") }}
          provenance={{
            sources: [
              { kind: "postings", label: t("prov.postings"), n: o.postingsThisQuarter },
              { kind: "surveys", label: t("prov.employersHeard"), n: o.employersHeard },
              { kind: "supply", label: t("prov.courses"), n: o.coursesTracked },
            ],
            asOf: o.asOf,
            isDemo: o.isDemo,
            lapsed: false,
          }}
        >
          <div className="mt-4">
            <PeopleFigure
              value={o.employersHeard}
              unit={t("people.employers")}
              approxLabel={t("people.approx")}
              sentence={t("home.headlineSentence", { districts: formatNumber(o.districts, lang) })}
              source={t("home.headlineSource", { postings: formatNumber(o.postingsThisQuarter, lang) })}
              lang={lang}
              size="lg"
              align="center"
            />
          </div>
        </Card>
      </section>

      <section aria-labelledby="personas-heading">
        <h2 id="personas-heading" className="ks-section__title">
          {t("home.personasHeading")}
        </h2>
        <CardCase label={t("home.personasLabel")}>
          {PERSONAS.map((p) => (
            <GatewayCard
              key={p.key}
              variant={p.variant}
              code={t(`home.${p.key}.code`)}
              name={t(`home.${p.key}.name`)}
              title={t(`home.${p.key}.title`)}
              human={t(`home.${p.key}.human`)}
              href={p.href}
              cta={t(`home.${p.key}.cta`)}
              lang={lang}
              headingLevel={3}
            />
          ))}
        </CardCase>
      </section>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton cards={5} />}>
      <HomeBody />
    </Suspense>
  );
}
