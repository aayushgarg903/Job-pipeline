// /radar: the emerging-skills radar (Architecture §6.5). Small multiples per curated term:
// worldwide activity vs Maharashtra job posts on a shared quarter axis, with honest notes.
import type { RadarTerm } from "@ks/contracts";
import { Badge, PlotChart, formatNumber } from "@ks/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NextStep, PageHead, Section, chartLabels, pageContext, skillLabeler } from "@/components/console/common";
import { loadRadar } from "@/components/console/data";
import { PageSkeleton } from "@/components/PageSkeleton";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Emerging skills" };

/** First index where a series reaches twice its starting level (null if it never does). */
function doublingAt(series: RadarTerm["global"]): number | null {
  const start = series[0]?.value ?? 0;
  if (start <= 0) return null;
  const i = series.findIndex((p) => p.value >= 2 * start);
  return i < 0 ? null : i;
}

const growth = (s: RadarTerm["global"]) => {
  const a = s[0]?.value ?? 0;
  const b = s[s.length - 1]?.value ?? 0;
  return a > 0 ? b / a : null;
};

async function RadarBody() {
  const [{ lang, t }, d] = await Promise.all([pageContext(), loadRadar()]);
  const label = skillLabeler(d.skills, lang);
  const untaught = d.terms.filter((x) => x.coursesTeaching === 0).length;

  return (
    <>
      <PageHead title={t("console.radar.title")} lede={t("console.radar.lede", { n: d.terms.length, untaught })} />
      <p className="ks-stock mb-6 max-w-[70ch] p-4">
        <strong>{t("console.radar.honestTitle")}</strong> {t("console.radar.honest")}
      </p>

      <div className="grid gap-8">
        {d.terms.map((term, i) => {
          const g = growth(term.global);
          const m = growth(term.mhPostings);
          const dg = doublingAt(term.global);
          const dm = doublingAt(term.mhPostings);
          const lag = dg !== null && dm !== null ? dm - dg : null;
          const x = (p: { period: string; value: number }) => ({ x: p.period, y: p.value });
          const id = `term-${i}`;
          return (
            <Section key={term.term} id={id} title={term.term}>
              <div className="ks-stock grid gap-3 p-4">
                <p className="m-0 flex flex-wrap items-center gap-2">
                  {term.coursesTeaching === 0 ? (
                    <Badge tone="gap" glyph="▲">{t("console.radar.noCourse")}</Badge>
                  ) : (
                    <Badge tone="ok" glyph="✓">{t("console.radar.courses", { n: term.coursesTeaching })}</Badge>
                  )}
                  {term.skillId ? <a className="underline" href={routes.skill(term.skillId)}>{t("console.radar.openSkill", { skill: label(term.skillId) })}</a> : <span className="text-sm">{t("console.radar.notInCatalogue")}</span>}
                </p>
                <p className="m-0">
                  {g !== null && m !== null
                    ? t("console.radar.growth", { g: formatNumber(g, lang, { maximumFractionDigits: 1 }), m: formatNumber(m, lang, { maximumFractionDigits: 1 }), n: term.global.length })
                    : null}{" "}
                  {lag !== null && lag > 0 ? t("console.radar.lag", { n: lag }) : lag !== null ? t("console.radar.noLag") : t("console.radar.lagUnknown")}
                </p>
                <p className="m-0 text-ink-muted">{term.note}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <PlotChart
                    title={t("console.radar.globalChart", { term: term.term })}
                    summary={t("console.radar.globalSummary", { from: formatNumber(term.global[0]?.value ?? 0, lang), to: formatNumber(term.global[term.global.length - 1]?.value ?? 0, lang) })}
                    chart={{ kind: "lineBand", data: term.global.map(x), yLabel: t("console.radar.globalAxis") }}
                    labels={chartLabels(t)}
                    height={200}
                    csvName={`radar-global-${i}`}
                    headers={{ x: t("console.common.quarter"), y: t("console.radar.globalAxis") }}
                  />
                  <PlotChart
                    title={t("console.radar.mhChart", { term: term.term })}
                    summary={t("console.radar.mhSummary", { from: formatNumber(term.mhPostings[0]?.value ?? 0, lang), to: formatNumber(term.mhPostings[term.mhPostings.length - 1]?.value ?? 0, lang) })}
                    chart={{ kind: "lineBand", data: term.mhPostings.map(x), yLabel: t("console.radar.mhAxis") }}
                    labels={chartLabels(t)}
                    height={200}
                    csvName={`radar-mh-${i}`}
                    headers={{ x: t("console.common.quarter"), y: t("console.radar.mhAxis") }}
                  />
                </div>
              </div>
            </Section>
          );
        })}
      </div>

      <NextStep
        t={t}
        sentence={t("console.radar.next")}
        actions={[
          { href: routes.state(), label: t("console.radar.openState"), primary: true, icon: "map" },
          { href: routes.review(), label: t("console.radar.openReview"), icon: "eye" },
        ]}
      />
    </>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={4} variant="skill" />}>
      <RadarBody />
    </Suspense>
  );
}
