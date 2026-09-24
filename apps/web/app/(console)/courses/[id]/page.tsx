// /courses/[id]: one course. Health explained in plain sentences, the skills it teaches vs
// what local employers want vs what it assesses (dot matrix), placement, and its open
// Curriculum PRs with who can approve them.
import { HEALTH_WEIGHTS } from "@ks/core";
import { Card, PeopleFigure, PlotChart, formatNumber } from "@ks/ui";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NextStep, PageHead, Section, Voices, cardLabels, chartLabels, evidenceLabels, pageContext, skillLabeler } from "@/components/console/common";
import { CurriculumPr } from "@/components/console/CurriculumPr";
import { loadCourse } from "@/components/console/data";
import { PageSkeleton } from "@/components/PageSkeleton";
import { courseCard } from "@/lib/cards";
import { routes } from "@/lib/routes";

const COMPONENTS = ["relevance", "outcomes", "currency", "validation"] as const;

async function CourseBody({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const [{ lang, t }, d] = await Promise.all([pageContext(), loadCourse(id)]);
  if (!d) notFound();
  const c = d.course;
  const h = c.health;
  const label = skillLabeler(d.skills, lang);
  const dname = d.summary ? (lang === "mr" ? d.summary.district.nameMr : d.summary.district.nameEn) : c.lgd;
  const L = cardLabels(t);
  const card = courseCard(c, dname, t, lang, label, d.asOf);
  const endorsements = d.prs.reduce((s, p) => s + p.endorsements, 0);

  // Dot matrix: every skill the course teaches or employers here ask for, against three questions.
  const demandBy = new Map(d.cells.map((x) => [x.skillId, x]));
  const taught = new Map(c.skills.map((s) => [s.skillId, s]));
  const rowIds = [...new Set([...c.skills.map((s) => s.skillId), ...(h?.missingSkills ?? []), ...(h?.decliningSkills ?? [])])];
  const cols = [t("console.course.matrix.taught"), t("console.course.matrix.wanted"), t("console.course.matrix.assessed")] as const;
  const matrix = rowIds.flatMap((sid) => {
    const cell = demandBy.get(sid);
    const wanted = (h?.missingSkills.includes(sid) ?? false) || (!!cell && cell.gap > 0 && !(h?.decliningSkills.includes(sid) ?? false));
    return [
      { row: label(sid), col: cols[0], covered: taught.has(sid) },
      { row: label(sid), col: cols[1], covered: wanted },
      { row: label(sid), col: cols[2], covered: taught.get(sid)?.assessed ?? false },
    ];
  });
  const wantedNotTaught = rowIds.filter((sid) => !taught.has(sid) && (h?.missingSkills.includes(sid) ?? false)).map(label);
  const taughtNotAssessed = c.skills.filter((s) => !s.assessed).map((s) => label(s.skillId));
  const placedPeople = h?.placementRate != null ? Math.round(h.placementRate * 100) : null;
  const isNcvt = c.kind === "ITI";

  return (
    <>
      <PageHead eyebrow={`${c.code} · ${t(`console.course.kind.${c.kind}`)}`} title={c.name} lede={t("console.course.lede", { institution: c.institutionName, district: dname })} />

      <div className="mb-8 grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <Card {...card} expanded headingLevel={2} endorsements={endorsements} figure={card.figure && { ...card.figure, evidence: d.evidence }} labels={L} evidenceLabels={evidenceLabels(t)} />
        <div className="ks-stock grid gap-3 p-5">
          {d.occupation ? <p className="m-0">{t("console.course.target", { occupation: lang === "mr" && d.occupation.titleMr ? d.occupation.titleMr : d.occupation.titleEn })}</p> : null}
          {h ? <ul className="m-0 grid gap-1 pl-5">{h.explain.map((x) => <li key={x}>{x}</li>)}</ul> : null}
          {endorsements ? <p className="m-0 text-ink-muted">{t("card.endorsed", { n: endorsements })}</p> : null}
        </div>
      </div>

      <Section id="health" title={t("console.course.healthTitle")} lede={h ? t("console.course.healthLede", { total: h.total }) : t("console.course.noHealth")}>
        {h ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ul className="ks-stock m-0 grid list-none gap-3 p-4">
              {COMPONENTS.map((k) => (
                <li key={k}>
                  <p className="m-0 flex justify-between gap-2 font-semibold">
                    <span>{t(`console.course.component.${k}`)}</span>
                    <span className="ks-mono">{h[k]}/100</span>
                  </p>
                  <p className="m-0 text-sm text-ink-muted">{t(`console.course.componentExplain.${k}`, { w: HEALTH_WEIGHTS[k] })}</p>
                </li>
              ))}
            </ul>
            <div className="ks-stock p-4">
              <h3 className="m-0 mb-2 font-semibold">{t("console.course.whyTitle")}</h3>
              <ul className="m-0 grid gap-2 pl-5">
                {h.missingSkills.map((sid) => <li key={`m-${sid}`}>{t("console.course.why.missing", { skill: label(sid) })}</li>)}
                {h.decliningSkills.map((sid) => <li key={`d-${sid}`}>{t("console.course.why.declining", { skill: label(sid) })}</li>)}
                {h.unassessedSkills.map((sid) => <li key={`u-${sid}`}>{t("console.course.why.unassessed", { skill: label(sid) })}</li>)}
                {h.flags.map((f) => <li key={`f-${f}`}>{t(`console.course.why.flag.${f}`)}</li>)}
              </ul>
            </div>
          </div>
        ) : null}
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section id="matrix" title={t("console.course.matrixTitle")}>
          <PlotChart
            title={t("console.course.matrixChart", { course: c.name })}
            summary={t("console.course.matrixSummary", {
              wanted: wantedNotTaught.length ? wantedNotTaught.join(", ") : t("console.course.nothing"),
              unassessed: taughtNotAssessed.length ? taughtNotAssessed.join(", ") : t("console.course.nothing"),
            })}
            chart={{ kind: "dotMatrix", data: matrix, colOrder: [...cols] }}
            labels={chartLabels(t)}
            csvName={`skills-${id}`}
            headers={{ row: t("console.common.skill"), col: t("console.course.matrix.question"), covered: t("console.course.matrix.yes") }}
          />
        </Section>
        <Section id="placement" title={t("console.course.placementTitle")}>
          {placedPeople !== null && h?.placementRate != null ? (
            <div className="ks-stock p-4">
              <PeopleFigure
                value={placedPeople}
                approx={false}
                unit={t("console.course.placementUnit", { seats: formatNumber(c.seats, lang) })}
                sentence={t("console.course.placementSentence", { n: Math.round(h.placementRate * 100) })}
                source={t("console.course.placementSource")}
                lang={lang}
              />
            </div>
          ) : (
            <p className="ks-stock m-0 p-4">{t("console.course.noPlacement")}</p>
          )}
        </Section>
      </div>

      <Section id="prs" title={t("console.course.prsTitle")} lede={d.prs.length ? t("console.course.prsLede", { n: d.prs.length }) : t("console.course.noPrs")}>
        <div className="grid grid-cols-1 gap-8">
          {d.prs.map((pr) => (
            <CurriculumPr key={pr.id} pr={pr} course={c} t={t} lang={lang} labels={L} skillLabels={Object.fromEntries(pr.diff.filter((l) => l.skillId).map((l) => [l.skillId!, label(l.skillId!)]))} asOf={d.asOf} districtName={dname} />
          ))}
        </div>
        <aside className="ks-stock mt-6 p-4" aria-labelledby="ncvt-note">
          <h3 id="ncvt-note" className="m-0 mb-1 font-semibold">{t("console.course.ncvtTitle")}</h3>
          <p className="m-0">{t(isNcvt ? "console.course.ncvtBody" : "console.course.stateBody")}</p>
        </aside>
      </Section>

      <Section id="voices" title={t("console.course.voicesTitle")}>
        <Voices rows={d.evidence} lang={lang} t={t} empty={t("evidence.empty")} />
      </Section>

      <NextStep
        t={t}
        sentence={d.prs.length ? t("console.course.nextPr") : t("console.course.next", { district: dname })}
        actions={[
          { href: routes.district(c.lgd), label: t("console.course.openDistrict", { district: dname }), primary: true },
          { href: routes.plan(c.lgd, "FY27"), label: t("console.course.openPlan") },
          { href: "/api/export/courses", label: t("console.common.downloadCsv", { what: t("console.course.csv") }), download: true },
        ]}
      />
    </>
  );
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton cards={2} variant="course" />}>
      <CourseBody params={params} />
    </Suspense>
  );
}
