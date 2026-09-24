// /skills/[id]: one skill across Maharashtra. Skill card, trend with an 80% band (forecast
// dashed), districts that need it most, courses that teach it, and job posts that ask for it.
import { MIN_HISTORY } from "@ks/core";
import { Card, PeopleFigure, PlotChart, formatDate, formatNumber } from "@ks/ui";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadEvidence } from "@/app/actions/console";
import { NextStep, PageHead, Section, Voices, cardLabels, chartLabels, evidenceLabels, pageContext, skillLabeler } from "@/components/console/common";
import { loadSkill } from "@/components/console/data";
import { PageSkeleton } from "@/components/PageSkeleton";
import { courseCard, skillCard } from "@/lib/cards";
import { routes } from "@/lib/routes";

async function SkillBody({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const [{ lang, t }, d] = await Promise.all([pageContext(), loadSkill(id)]);
  if (!d) notFound();
  const label = lang === "mr" && d.skill.labelMr ? d.skill.labelMr : d.skill.labelEn;
  const dname = (lgd: string) => (lang === "mr" ? d.names[lgd]?.mr : d.names[lgd]?.en) ?? lgd;
  const L = cardLabels(t);
  const E = evidenceLabels(t);

  const byGap = [...d.cells].sort((a, b) => b.gap - a.gap);
  const top = byGap[0];
  const demand = d.cells.reduce((s, c) => s + c.demand, 0);
  const supply = d.cells.reduce((s, c) => s + c.supply, 0);
  const current = top?.quarter ?? "";
  const trend = d.trend.map((p) => ({ x: p.quarter, y: p.sdi, low: p.ciLow, high: p.ciHigh, forecast: p.quarter > current }));
  const actual = trend.filter((p) => !p.forecast);
  const first = actual[0];
  const last = actual[actual.length - 1];
  const forecastEnd = trend[trend.length - 1];
  const shortHistory = actual.length < MIN_HISTORY;
  const shortages = byGap.filter((c) => c.gap > 0).slice(0, 10);
  const sc = top ? skillCard(d.skill, top, dname(top.lgd), d.delta, t, lang, d.asOf) : null;
  const lowCoverage = shortages.filter((c) => (d.names[c.lgd]?.coverage ?? 1) < 0.4).length;

  return (
    <>
      <PageHead eyebrow={t(`console.skill.kind.${d.skill.kind}`)} title={label} lede={t("console.skill.lede", { skill: label })} />

      {sc ? (
        <div className="mb-8 grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <Card {...sc} expanded headingLevel={2} figure={sc.figure && { ...sc.figure, evidence: d.evidence }} labels={L} evidenceLabels={E} />
          <div className="ks-stock grid gap-3 p-5">
            <PeopleFigure value={Math.abs(demand - supply)} unit={t("people.people")} approxLabel={t("people.approx")} sentence={t(demand >= supply ? "console.skill.shortState" : "console.skill.surplusState")} lang={lang} />
            <p className="m-0">
              {t.rich("console.skill.state", { demand: formatNumber(Math.round(demand), lang), supply: formatNumber(Math.round(supply), lang), districts: d.cells.length, b: (c) => <strong>{c}</strong> })}
            </p>
          </div>
        </div>
      ) : (
        <p className="ks-stock mb-8 p-4">{t("console.skill.noCells", { skill: label })}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section id="trend" title={t("console.skill.trendTitle")}>
          {trend.length ? (
            <PlotChart
              title={t("console.skill.trendChart", { skill: label })}
              summary={
                first && last && forecastEnd
                  ? t("console.skill.trendSummary", { from: formatNumber(first.y, lang), to: formatNumber(last.y, lang), fq: forecastEnd.x, f: formatNumber(forecastEnd.y, lang), low: formatNumber(forecastEnd.low ?? forecastEnd.y, lang), high: formatNumber(forecastEnd.high ?? forecastEnd.y, lang) })
                  : t("console.skill.trendNone")
              }
              chart={{ kind: "lineBand", data: trend, yLabel: t("skillCard.figure"), forecastLabel: t("console.skill.forecast") }}
              labels={chartLabels(t)}
              csvName={`trend-${id}`}
              headers={{ x: t("console.common.quarter"), y: t("skillCard.figure"), low: t("console.skill.low"), high: t("console.skill.high") }}
            />
          ) : null}
          <p className="mt-2 text-sm">{shortHistory ? t("console.skill.shortHistory", { n: actual.length }) : t("console.skill.sdiNote")}</p>
        </Section>

        <Section id="where" title={t("console.skill.whereTitle")}>
          <PlotChart
            title={t("console.skill.whereChart", { skill: label })}
            summary={
              shortages[0]
                ? t("console.skill.whereSummary", { district: dname(shortages[0].lgd), n: formatNumber(shortages[0].gap, lang), count: shortages.length })
                : t("console.skill.whereNone")
            }
            chart={{ kind: "barSorted", data: shortages.map((c, i) => ({ label: dname(c.lgd), value: c.gap, highlight: i === 0 })), xLabel: t("fields.gap") }}
            labels={chartLabels(t)}
            csvName={`districts-${id}`}
            headers={{ label: t("fields.district"), value: t("fields.gap") }}
          />
          {lowCoverage ? <p className="mt-2 text-sm">{t("console.skill.lowCoverage", { n: lowCoverage })}</p> : null}
        </Section>
      </div>

      {d.radar ? (
        <Section id="radar" title={t("console.skill.radarTitle")}>
          <p className="ks-stock m-0 p-4">{d.radar.note} {t("console.skill.radarCourses", { n: d.radar.coursesTeaching })}</p>
        </Section>
      ) : null}

      <Section id="courses" title={t("console.skill.coursesTitle")} lede={t("console.skill.coursesLede", { n: d.courses.length })}>
        {d.courses.length ? (
          <div className="ks-card-grid">
            {d.courses.map((c) => {
              const p = courseCard(c, dname(c.lgd), t, lang, skillLabeler(d.skills, lang), d.asOf);
              return <Card key={c.id} {...p} figure={p.figure && { ...p.figure, loadEvidence: loadEvidence.bind(null, "course", c.id, undefined) }} labels={L} evidenceLabels={E} />;
            })}
          </div>
        ) : (
          <p className="ks-stock p-4">{t("console.skill.noCourses", { skill: label })}</p>
        )}
      </Section>

      <Section id="postings" title={t("console.skill.postingsTitle")} lede={t("console.skill.postingsLede")}>
        <Voices rows={d.evidence} lang={lang} t={t} empty={t("evidence.empty")} />
        {d.postings.length ? (
          <ul className="ks-stock m-0 mt-4 grid list-none gap-2 p-4">
            {d.postings.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span><strong>{p.title}</strong> · {p.employer}{p.city ? `, ${p.city}` : ""}{p.lgd ? ` (${dname(p.lgd)})` : ""}</span>
                <span className="ks-mono text-sm">{formatDate(p.postedAt, lang)} · {p.source}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <NextStep
        t={t}
        sentence={top ? t("console.skill.next", { skill: label, district: dname(top.lgd) }) : t("console.skill.nextNone")}
        actions={[
          ...(top ? [{ href: routes.district(top.lgd), label: t("console.skill.openDistrict", { district: dname(top.lgd) }), primary: true }] : []),
          { href: routes.radar(), label: t("console.skill.openRadar"), icon: "broadcast" as const },
          { href: "/api/export/skills", label: t("console.common.downloadCsv", { what: t("console.skill.csv") }), download: true },
        ]}
      />
    </>
  );
}

export default function SkillPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton cards={3} variant="skill" />}>
      <SkillBody params={params} />
    </Suspense>
  );
}
