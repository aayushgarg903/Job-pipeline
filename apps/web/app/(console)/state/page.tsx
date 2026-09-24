// /state: the state officer's overview. One humane headline, the district map with its
// table, 36 district cards (most mismatched first), what's rising, flag counts, freshness.
import type { CourseFlag } from "@ks/contracts";
import { Badge, Card, FreshnessStrip, PeopleFigure, VERDICTS, formatNumber, formatPercent, humanRound } from "@ks/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadEvidence } from "@/app/actions/console";
import { NextStep, PageHead, Section, cardLabels, evidenceLabels, pageContext, skillLabeler } from "@/components/console/common";
import { DistrictPicker } from "@/components/console/DistrictPicker";
import { loadState } from "@/components/console/data";
import { PageSkeleton } from "@/components/PageSkeleton";
import { districtCard } from "@/lib/cards";
import { StateMap } from "@/components/console/StateMap";
import { routeTemplates, routes } from "@/lib/routes";

export const metadata: Metadata = { title: "State overview" };

const FLAGS: CourseFlag[] = ["HEALTHY", "REVISE", "OVERSUPPLIED", "OBSOLETE"];

async function StateBody() {
  const [{ lang, t }, d] = await Promise.all([pageContext(), loadState()]);
  const label = skillLabeler(d.skills, lang);
  const name = (s: (typeof d.districts)[number]) => (lang === "mr" ? s.district.nameMr : s.district.nameEn);
  const sorted = [...d.districts].sort((a, b) => b.mismatch - a.mismatch);
  const L = cardLabels(t);
  const E = evidenceLabels(t);
  const lowSignal = d.districts.filter((s) => s.coverage < 0.4).length;
  const rows = d.districts.map((s) => ({
    lgd: s.district.lgd,
    name: name(s),
    value: s.mismatch,
    coverage: s.coverage,
    display: formatNumber(s.mismatch, lang, { maximumFractionDigits: 2 }),
    shortage: s.topShortage ? label(s.topShortage.skillId) : "—",
    gap: s.topShortage?.gap ?? 0,
    postings: s.postings,
  }));
  const worst = sorted[0];
  const o = d.overview;

  return (
    <>
      <PageHead
        eyebrow={t("console.state.eyebrow", { n: formatNumber(o.districts, lang) })}
        title={t("console.state.title")}
        lede={t("console.state.lede")}
      />

      <section className="ks-stock mb-8 grid gap-4 p-6 md:grid-cols-[1.4fr_1fr]" aria-labelledby="headline">
        <h2 id="headline" className="sr-only">{t("console.state.headlineHeading")}</h2>
        <PeopleFigure
          value={d.peopleShort}
          unit={t("people.people")}
          approxLabel={t("people.approx")}
          sentence={t("console.state.headline", { trained: formatNumber(humanRound(d.trainedLocally), lang) })}
          source={t("console.state.headlineSource", { postings: formatNumber(o.postingsThisQuarter, lang), employers: formatNumber(o.employersHeard, lang) })}
          lang={lang}
          size="xl"
        />
        <div className="grid content-start gap-3">
          {worst ? (
            <p className="m-0">
              {t.rich("console.state.worst", { district: name(worst), skill: worst.topShortage ? label(worst.topShortage.skillId) : "—", b: (c) => <strong>{c}</strong> })}
            </p>
          ) : null}
          <p className="m-0 text-ink-muted">{t("console.state.honesty", { n: lowSignal })}</p>
        </div>
      </section>

      <Section id="map" title={t("console.state.mapTitle")} lede={t("console.state.mapLede")}>
        <StateMap
          rows={rows}
          caption={t("console.state.tableCaption")}
          hrefTemplate={routeTemplates.district}
          initialSort={{ key: "value", dir: "descending" }}
          lang={lang}
          mapLabels={t.raw("map") as never}
          tableLabels={t.raw("table") as never}
          columns={[
            { key: "name", header: t("fields.district") },
            { key: "value", header: t("fields.mismatch"), format: "decimal" },
            { key: "shortage", header: t("fields.shortage") },
            { key: "gap", header: t("fields.gap"), format: "people" },
            { key: "postings", header: t("console.common.jobPosts"), format: "number" },
            { key: "coverage", header: t("fields.coverage"), format: "percent" },
          ]}
        />
        <p className="mt-2 text-sm">
          <a href="/api/export/districts" download className="underline">{t("console.common.downloadCsv", { what: t("console.state.csvDistricts") })}</a>
        </p>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section id="rising" title={t("console.state.risingTitle")} lede={t("console.state.risingLede")}>
          <ol className="ks-stock m-0 grid list-none gap-2 p-4">
            {d.rising.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <a href={routes.skill(s.id)} className="font-semibold underline">{label(s.id)}</a>
                <span className="ks-mono text-sm">
                  {t("console.state.risingRow", { delta: formatNumber(s.delta, lang), sdi: formatNumber(s.sdi, lang) })}
                </span>
              </li>
            ))}
          </ol>
        </Section>
        <Section id="flags" title={t("console.state.flagsTitle")} lede={t("console.state.flagsLede", { n: formatNumber(o.coursesTracked, lang) })}>
          <ul className="ks-stock m-0 grid list-none gap-2 p-4">
            {FLAGS.map((f) => (
              <li key={f} className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={VERDICTS[f].tone} glyph={VERDICTS[f].glyph}>{t(`verdict.${f}`)}</Badge>
                <span>{t(`console.state.flag.${f}`, { n: formatNumber(o.flagCounts[f] ?? 0, lang) })}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section id="districts" title={t("console.state.cardsTitle")} lede={t("console.state.cardsLede")}>
        <div className="ks-card-grid">
          {sorted.map((s) => {
            const p = districtCard(s, t, lang, d.topCells[s.district.lgd] ?? undefined, label);
            return (
              <Card
                key={s.district.lgd}
                {...p}
                figure={p.figure && { ...p.figure, loadEvidence: loadEvidence.bind(null, "district", s.district.lgd, undefined) }}
                labels={L}
                evidenceLabels={E}
              />
            );
          })}
        </div>
      </Section>

      <Section id="fresh" title={t("console.state.freshTitle")}>
        <FreshnessStrip sources={d.sources} lang={lang} labels={t.raw("fresh") as never} />
        <p className="mt-2 text-sm">
          <a href={routes.sources()} className="underline">{t("console.state.freshLink")}</a>
          {" · "}
          {t("console.state.coverageNote", { pct: formatPercent(d.districts.reduce((a, s) => a + s.coverage, 0) / Math.max(1, d.districts.length), lang) })}
        </p>
      </Section>

      <NextStep t={t} sentence={t("console.state.next")} actions={[{ href: routes.radar(), label: t("console.state.nextRadar") }]}>
        <DistrictPicker
          options={[...d.districts].sort((a, b) => name(a).localeCompare(name(b), lang)).map((s) => ({ lgd: s.district.lgd, name: name(s) }))}
          label={t("console.state.pickLabel")}
          button={t("console.state.pickButton")}
        />
      </NextStep>
    </>
  );
}

export default function StatePage() {
  return (
    <Suspense fallback={<PageSkeleton cards={6} />}>
      <StateBody />
    </Suspense>
  );
}
