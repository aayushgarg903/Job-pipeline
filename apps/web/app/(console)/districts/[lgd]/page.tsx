// /districts/[lgd]: the District Dossier. Expanded district card with one people-sentence
// and an honest confidence line, the gap table + sorted bar, the district's courses, voices
// from postings and surveys, districts to compare with, and the training-plan link.
import { confidencePhrase, peopleSentence } from "@ks/core";
import { Card, DataTable, PeopleFigure, PlotChart, formatDate, formatNumber } from "@ks/ui";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadEvidence } from "@/app/actions/console";
import { NextStep, PageHead, Section, Voices, cardLabels, chartLabels, evidenceLabels, pageContext, skillLabeler } from "@/components/console/common";
import { loadDistrict } from "@/components/console/data";
import { PageSkeleton } from "@/components/PageSkeleton";
import { courseCard, districtCard, divisionKey } from "@/lib/cards";
import { routes } from "@/lib/routes";

const PLAN_FY = "FY27";

async function DistrictBody({ params }: { params: Promise<{ lgd: string }> }) {
  const { lgd: raw } = await params;
  const lgd = decodeURIComponent(raw);
  const [{ lang, t }, d] = await Promise.all([pageContext(), loadDistrict(lgd)]);
  if (!d) notFound();
  const s = d.summary;
  const label = skillLabeler(d.skills, lang);
  const name = lang === "mr" ? s.district.nameMr : s.district.nameEn;
  const L = cardLabels(t);
  const E = evidenceLabels(t);
  const top = d.cells.find((c) => c.skillId === s.topShortage?.skillId);
  const surveys = s.provenance.sources.find((x) => x.kind === "surveys")?.n;
  const confidence = confidencePhrase({ coverage: s.coverage, employers: surveys, lang });
  const sentence = top
    ? peopleSentence({ gap: { demand: top.demand, supply: top.supply }, district: name, occupationLabel: t("console.district.occupation", { skill: label(top.skillId) }), lang })
    : t("districtCard.humanNone", { district: name });
  const card = districtCard(s, t, lang, top, label);
  const division = t(`divisions.${divisionKey(s.district.division)}`);

  const shortages = d.cells.filter((c) => c.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 8);
  const rows = d.cells.map((c) => ({ id: c.skillId, skill: label(c.skillId), demand: c.demand, supply: c.supply, gap: c.gap, sdi: c.sdi }));
  const biggestSurplus = [...d.cells].sort((a, b) => a.gap - b.gap)[0];

  return (
    <>
      <PageHead
        eyebrow={`LGD ${s.district.lgd} · ${t("districtCard.title", { division })}`}
        title={name}
        lede={t("console.district.lede", { district: name })}
      />

      <div className="mb-8 grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <Card {...card} expanded headingLevel={2} human={sentence} figure={card.figure && { ...card.figure, evidence: d.evidence }} labels={L} evidenceLabels={E} />
        <div className="ks-stock grid gap-3 p-5">
          {top && top.gap > 0 ? (
            <PeopleFigure value={top.gap} unit={t("people.people")} approxLabel={t("people.approx")} sentence={t("console.district.shortBy", { skill: label(top.skillId) })} lang={lang} />
          ) : null}
          <p className="m-0">{confidence}</p>
          {s.coverage < 0.4 ? <p className="m-0">{t("districtCard.lowSignal", { postings: formatNumber(s.postings, lang) })}</p> : null}
          {s.district.isAspirational ? <p className="m-0 text-ink-muted">{t("console.district.aspirational")}</p> : null}
        </div>
      </div>

      <Section id="gaps" title={t("console.district.gapTitle")} lede={t("console.district.gapLede", { district: name })}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PlotChart
            title={t("console.district.chartTitle", { district: name })}
            summary={
              shortages[0]
                ? t("console.district.chartSummary", { skill: label(shortages[0].skillId), n: formatNumber(shortages[0].gap, lang), count: shortages.length })
                : t("console.district.chartNone")
            }
            chart={{ kind: "barSorted", data: shortages.map((c, i) => ({ label: label(c.skillId), value: c.gap, highlight: i === 0 })), xLabel: t("fields.gap") }}
            labels={chartLabels(t)}
            csvName={`gaps-${lgd}`}
            headers={{ label: t("console.common.skill"), value: t("fields.gap") }}
          />
          <div className="ks-stock p-2">
            <DataTable
              caption={t("console.district.tableCaption", { district: name })}
              rows={rows}
              rowKey="id"
              rowHref="/skills/{id}"
              initialSort={{ key: "gap", dir: "descending" }}
              lang={lang}
              labels={t.raw("table") as never}
              columns={[
                { key: "skill", header: t("console.common.skill") },
                { key: "demand", header: t("fields.demand"), format: "people" },
                { key: "supply", header: t("fields.supply"), format: "people" },
                { key: "gap", header: t("fields.gap"), format: "people" },
              ]}
            />
          </div>
        </div>
        {biggestSurplus && biggestSurplus.gap < 0 ? (
          <p className="mt-3 max-w-[62ch]">
            {t("console.district.surplus", { skill: label(biggestSurplus.skillId), n: formatNumber(Math.abs(biggestSurplus.gap), lang) })}
          </p>
        ) : null}
      </Section>

      <Section id="courses" title={t("console.district.coursesTitle")} lede={t("console.district.coursesLede", { n: d.courses.length })}>
        {d.courses.length ? (
          <div className="ks-card-grid">
            {d.courses.map((c) => {
              const p = courseCard(c, name, t, lang, label, d.asOf);
              return (
                <Card
                  key={c.id}
                  {...p}
                  figure={p.figure && { ...p.figure, loadEvidence: loadEvidence.bind(null, "course", c.id, undefined) }}
                  labels={L}
                  evidenceLabels={E}
                />
              );
            })}
          </div>
        ) : (
          <p className="ks-stock p-4">{t("console.district.noCourses", { district: name })}</p>
        )}
      </Section>

      <Section id="voices" title={t("console.district.voicesTitle")} lede={t("console.district.voicesLede", { district: name })}>
        <Voices rows={d.evidence} lang={lang} t={t} empty={t("evidence.empty")} />
        {d.postings.length ? (
          <>
            <h3 className="mt-6 mb-2 font-semibold">{t("console.district.postingsTitle")}</h3>
            <ul className="ks-stock m-0 grid list-none gap-2 p-4">
              {d.postings.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span><strong>{p.title}</strong> · {p.employer}{p.city ? `, ${p.city}` : ""}</span>
                  <span className="ks-mono text-sm">{formatDate(p.postedAt, lang)} · {p.source}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Section>

      {d.neighbours.length ? (
        <Section id="compare" title={t("console.district.compareTitle")} lede={t("console.district.compareLede", { division })}>
          <div className="ks-card-grid">
            {d.neighbours.map((n, i) => {
              const nc = d.neighbourCells[i]?.find((c) => c.skillId === n.topShortage?.skillId);
              return <Card key={n.district.lgd} {...districtCard(n, t, lang, nc, label)} labels={L} evidenceLabels={E} />;
            })}
          </div>
        </Section>
      ) : null}

      <NextStep
        t={t}
        sentence={t("console.district.next", { district: name, fy: PLAN_FY })}
        actions={[
          { href: routes.plan(lgd, PLAN_FY), label: t("console.district.openPlan", { fy: PLAN_FY }), primary: true },
          ...(top ? [{ href: routes.skill(top.skillId), label: t("console.district.openSkill", { skill: label(top.skillId) }) }] : []),
          { href: routes.state(), label: t("console.common.backToState"), icon: "map" as const },
        ]}
      />
    </>
  );
}

export default function DistrictPage({ params }: { params: Promise<{ lgd: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton cards={3} />}>
      <DistrictBody params={params} />
    </Suspense>
  );
}
