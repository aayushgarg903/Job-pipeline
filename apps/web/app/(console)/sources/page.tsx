// /sources: where every number comes from. One card per source with health, last fetch, rows,
// licence and freshness SLA (LAPSED watermark when past it), plus the fixed fusion weights
// that Architecture §6.1 says are published here.
import { DEFAULT_WEIGHTS, SIGNAL_KINDS } from "@ks/core";
import { Card, FreshnessStrip, VERDICTS, formatDateTime, formatNumber, formatPercent } from "@ks/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { NextStep, PageHead, Section, cardLabels, pageContext, slaPhrase } from "@/components/console/common";
import { loadSources } from "@/components/console/data";
import { PageSkeleton } from "@/components/PageSkeleton";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Data sources" };

async function SourcesBody() {
  const [{ lang, t }, d] = await Promise.all([pageContext(), loadSources()]);
  const L = cardLabels(t);
  const lapsed = d.sources.filter((s) => !s.ok);

  return (
    <>
      <PageHead title={t("console.sources.title")} lede={t("console.sources.lede", { n: d.sources.length })} />
      <div className="mb-6">
        <FreshnessStrip sources={d.sources} lang={lang} labels={t.raw("fresh") as never} />
      </div>
      {lapsed.length ? (
        <p className="ks-stock mb-6 max-w-[70ch] p-4">{t("console.sources.lapsedNote", { names: lapsed.map((s) => s.name).join(", ") })}</p>
      ) : null}

      <Section id="cards" title={t("console.sources.cardsTitle")}>
        <div className="ks-card-grid">
          {d.sources.map((s) => {
            const v = s.ok ? VERDICTS.HEALTHY : VERDICTS.OBSOLETE;
            return (
              <Card
                key={s.id}
                variant="plan"
                code={s.kind.toUpperCase()}
                name={s.name}
                title={s.licence}
                figure={{ label: t("console.sources.rows"), value: formatNumber(s.rows, lang), evidenceTitle: t("console.sources.rowsTitle", { name: s.name }) }}
                verdict={{ tone: v.tone, glyph: v.glyph, word: s.ok ? t("fresh.fresh") : t("fresh.lapsed"), text: t("console.sources.sla", { every: slaPhrase(s.freshnessSlaHours, t) }) }}
                human={
                  <>
                    {s.lastFetchAt ? t("console.sources.lastFetch", { when: formatDateTime(s.lastFetchAt, lang) }) : t("fresh.never")} {s.note}
                  </>
                }
                provenance={{ sources: [{ kind: "trend", label: t("console.sources.rowsLabel"), n: s.rows }], asOf: s.lastFetchAt ?? d.overview.asOf, isDemo: d.overview.isDemo, lapsed: !s.ok }}
                lang={lang}
                labels={L}
              />
            );
          })}
        </div>
      </Section>

      <Section id="weights" title={t("console.sources.weightsTitle")} lede={t("console.sources.weightsLede")}>
        <table className="ks-dt ks-stock w-full max-w-xl">
          <caption className="sr-only">{t("console.sources.weightsTitle")}</caption>
          <thead>
            <tr><th scope="col">{t("console.sources.signal")}</th><th scope="col">{t("console.sources.weight")}</th></tr>
          </thead>
          <tbody>
            {SIGNAL_KINDS.map((k) => (
              <tr key={k}>
                <th scope="row">{t(`console.sources.kind.${k}`)}</th>
                <td className="ks-mono">{formatPercent(DEFAULT_WEIGHTS[k], lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 max-w-[62ch] text-sm">{t("console.sources.weightsNote")}</p>
      </Section>

      <NextStep
        t={t}
        sentence={lapsed.length ? t("console.sources.nextLapsed", { name: lapsed[0]!.name }) : t("console.sources.next")}
        actions={[
          { href: routes.review(), label: t("console.sources.openReview"), primary: true, icon: "eye" },
          { href: routes.feedback(), label: t("console.sources.feedback") },
        ]}
      />
    </>
  );
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={6} variant="plan" />}>
      <SourcesBody />
    </Suspense>
  );
}
