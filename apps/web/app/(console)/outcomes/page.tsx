// /outcomes: did it work? One card per outcome KPI (Architecture §6.8): baseline → current,
// with a plain sentence each and the note that says where the number comes from.
import { Card, formatNumber } from "@ks/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NextStep, PageHead, Section, cardLabels, pageContext } from "@/components/console/common";
import { loadOutcomes } from "@/components/console/data";
import { PageSkeleton } from "@/components/PageSkeleton";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Outcomes" };

async function OutcomesBody() {
  const [{ lang, t }, d] = await Promise.all([pageContext(), loadOutcomes()]);
  const L = cardLabels(t);

  return (
    <>
      <PageHead title={t("console.outcomes.title")} lede={t("console.outcomes.lede")} />
      <Section id="kpis" title={t("console.outcomes.cardsTitle", { n: d.kpis.length })}>
        <div className="ks-card-grid">
          {d.kpis.map((k, i) => {
            const diff = k.current - k.baseline;
            const dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
            const sentence =
              k.baseline === 0
                ? t("console.outcomes.fromZero", { current: formatNumber(k.current, lang), unit: k.unit })
                : t(`console.outcomes.moved.${dir}`, { baseline: formatNumber(k.baseline, lang), current: formatNumber(k.current, lang), unit: k.unit });
            return (
              <Card
                key={k.kpi}
                variant="plan"
                code={`KPI ${i + 1}`}
                name={k.kpi}
                title={k.unit}
                figure={{
                  label: t("console.outcomes.now"),
                  value: formatNumber(k.current, lang),
                  delta: { text: formatNumber(Math.abs(diff), lang), dir },
                  evidenceTitle: k.kpi,
                  evidence: [{ kind: "dataset", title: k.kpi, detail: k.note, source: t("console.outcomes.source"), date: d.asOf, url: null }],
                }}
                verdict={{ tone: diff > 0 ? "ok" : diff < 0 ? "gap" : "neutral", glyph: diff > 0 ? "▲" : diff < 0 ? "▼" : "=", word: t(`console.outcomes.word.${dir}`), text: t("console.outcomes.baseline", { baseline: formatNumber(k.baseline, lang), current: formatNumber(k.current, lang) }) }}
                human={<>{sentence} <span className="text-ink-muted">{k.note}</span></>}
                provenance={{ sources: [{ kind: "placement", label: k.unit, n: k.current }], asOf: d.asOf, isDemo: d.isDemo, lapsed: false }}
                lang={lang}
                labels={L}
              />
            );
          })}
        </div>
      </Section>
      <p className="ks-stock max-w-[70ch] p-4">{t("console.outcomes.honest")}</p>
      <NextStep
        t={t}
        sentence={t("console.outcomes.next")}
        actions={[
          { href: routes.state(), label: t("console.outcomes.openState"), primary: true, icon: "map" },
          { href: routes.plan("487", "FY27"), label: t("console.outcomes.openPlan") },
        ]}
      />
    </>
  );
}

export default function OutcomesPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={4} variant="plan" />}>
      <OutcomesBody />
    </Suspense>
  );
}
