// /plans/[lgd]/[fy]: the District Training Plan (Architecture §6.6). The plan is solved on the
// server with HiGHS on every render (cached per knobs); the officer adjusts the knobs, re-plans,
// and signs. The narrative comes from templateNarrate('plan-summary'), grounded in the result.
import { templateNarrate } from "@ks/ai";
import { rupees } from "@ks/core";
import { Card, PeopleFigure, PlotChart, VERDICTS, formatDate, formatNumber } from "@ks/ui";
import { Suspense } from "react";
import { NextStep, PageHead, Section, cardLabels, chartLabels, pageContext } from "@/components/console/common";
import { loadPlanInput } from "@/components/console/data";
import { PlanControls, PlanSign } from "@/components/console/PlanControls";
import { LAKH, LAMBDA_RANGE, lambdaOf, parseKnobs, planTotals, solvePlan } from "@/components/console/plan";
import { PageSkeleton } from "@/components/PageSkeleton";
import { FOCUS } from "@/lib/fixtures";
import { routes } from "@/lib/routes";

type Params = Promise<{ lgd: string; fy: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

async function PlanBody({ params, searchParams }: { params: Params; searchParams: Search }) {
  const p = await params;
  const lgd = decodeURIComponent(p.lgd);
  const fy = decodeURIComponent(p.fy).toUpperCase();
  const [{ lang, t }, base, sp] = await Promise.all([pageContext(), loadPlanInput(lgd, fy), searchParams]);
  const knobs = parseKnobs(sp);
  const dname = base.summary ? (lang === "mr" ? base.summary.district.nameMr : base.summary.district.nameEn) : lgd;
  const here = routes.plan(lgd, fy);

  if (!base.input) {
    return (
      <>
        <PageHead eyebrow={`${dname} · ${fy}`} title={t("console.plan.title", { district: dname, fy })} lede={t("console.plan.noInput", { district: dname, fy })} />
        <p className="ks-stock max-w-[62ch] p-4">{t("console.plan.noInputWhy")}</p>
        <NextStep
          t={t}
          sentence={t("console.plan.noInputNext", { district: dname })}
          actions={[
            { href: routes.district(lgd), label: t("console.plan.openDistrict", { district: dname }), primary: true },
            ...(lgd !== FOCUS.nashik ? [{ href: routes.plan(FOCUS.nashik, "FY27"), label: t("console.plan.example") }] : []),
          ]}
        />
      </>
    );
  }

  const solved = await solvePlan(lgd, fy, knobs.seats ?? null, knobs.capex ?? null, knobs.lambda ?? null, lang, dname);
  if (!solved) return null;
  const { input, result } = solved;
  const tot = planTotals(input, result);
  const ok = result.status === "optimal";
  const narrative = templateNarrate(
    "plan-summary",
    { district: base.summary?.district.nameEn ?? lgd, districtMr: base.summary?.district.nameMr, fy, status: result.status, seats: ok ? tot.seats : null, seatsPrev: tot.seatsPrev, expectedPlacements: ok ? Math.round(result.expectedPlacements) : null, trainersToHire: tot.trainers, capexUsed: result.capexUsed },
    lang,
  );
  const prevFy = `FY${String(Number(fy.slice(2)) - 1).padStart(2, "0")}`;
  const cuts = result.rows.filter((r) => r.seats < r.seatsPrev);
  const adds = result.rows.filter((r) => r.seats > r.seatsPrev);
  const saved = base.saved;
  const L = cardLabels(t);
  const modified = knobs.seats !== undefined || knobs.capex !== undefined || knobs.lambda !== undefined;

  return (
    <>
      <PageHead eyebrow={`${dname} · ${fy}`} title={t("console.plan.title", { district: dname, fy })} lede={t("console.plan.lede")} />

      <div className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card
          variant="plan"
          code={`${dname} · ${fy}`}
          name={t("console.plan.cardName")}
          title={saved?.signedBy ? t("console.plan.signedBy", { name: saved.signedBy, date: saved.signedAt ? formatDate(saved.signedAt, lang) : "" }) : t("console.plan.unsigned")}
          figure={ok ? { label: t("console.plan.placed"), value: formatNumber(Math.round(result.expectedPlacements), lang), evidenceTitle: t("console.plan.placedTitle") } : undefined}
          verdict={ok ? { ...VERDICTS.HEALTHY, word: t("console.plan.moved", { n: formatNumber(tot.moved, lang) }) } : { ...VERDICTS.OBSOLETE, word: t(`console.plan.status.${result.status}`) }}
          human={narrative}
          provenance={{ sources: [{ kind: "supply", label: t("console.plan.courses"), n: input.courses.length }, { kind: "postings", label: t("console.plan.skillsDemand"), n: Object.keys(input.demandBySkill).length }], asOf: base.asOf, isDemo: base.summary?.provenance.isDemo ?? true, lapsed: false }}
          lang={lang}
          labels={L}
          expanded
          headingLevel={2}
        >
          {modified ? <p className="mt-2 text-sm">{t("console.plan.modified")}</p> : null}
        </Card>
        <PlanControls
          action={here}
          seats={input.seatBudget}
          capexLakh={Math.round((input.capexBudget / LAKH) * 10) / 10}
          lambda={lambdaOf(input)}
          range={LAMBDA_RANGE}
          labels={t.raw("console.plan.controls") as never}
        />
      </div>

      {ok ? (
        <>
          <Section id="seats" title={t("console.plan.seatsTitle")}>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <PlotChart
                title={t("console.plan.slopeTitle", { district: dname })}
                summary={t("console.plan.slopeSummary", {
                  adds: adds.map((r) => `${r.name} ${r.seatsPrev} → ${r.seats}`).join(", ") || t("console.course.nothing"),
                  cuts: cuts.map((r) => `${r.name} ${r.seatsPrev} → ${r.seats}`).join(", ") || t("console.course.nothing"),
                })}
                chart={{ kind: "slope", data: result.rows.map((r) => ({ label: r.name, before: r.seatsPrev, after: r.seats })), beforeLabel: prevFy, afterLabel: fy }}
                labels={chartLabels(t)}
                csvName={`plan-${lgd}-${fy}`}
                headers={{ label: t("console.plan.course"), before: prevFy, after: fy }}
              />
              <div className="ks-stock grid content-start gap-4 p-4">
                <PeopleFigure value={result.expectedPlacements} unit={t("people.people")} approxLabel={t("people.approx")} sentence={t("console.plan.placedSentence", { seats: formatNumber(tot.seats, lang) })} lang={lang} />
                <p className="m-0 text-sm">{t("console.plan.placedHonest")}</p>
              </div>
            </div>
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section id="trainers" title={t("console.plan.trainersTitle")}>
              <ul className="ks-stock m-0 grid list-none gap-2 p-4">
                {Object.entries(result.trainersToHire).filter(([, n]) => n > 0).map(([q, n]) => (
                  <li key={q}>{t("console.plan.trainerRow", { n, q, cost: rupees((input.trainerHireCost[q] ?? 0) * n, { lang }) })}</li>
                ))}
                {tot.trainers === 0 ? <li>{t("console.plan.noTrainers")}</li> : null}
              </ul>
            </Section>
            <Section id="equipment" title={t("console.plan.equipmentTitle")}>
              <ul className="ks-stock m-0 grid list-none gap-2 p-4">
                {tot.equipment.map((e) => <li key={e.courseId}>{t("console.plan.equipmentRow", { n: e.sets, course: e.name, cost: rupees(e.cost, { lang }) })}</li>)}
                {!tot.equipment.length ? <li>{t("console.plan.noEquipment")}</li> : null}
                <li className="text-sm text-ink-muted">{t("console.plan.capexUsed", { used: rupees(result.capexUsed, { lang }), budget: rupees(input.capexBudget, { lang }) })}</li>
              </ul>
            </Section>
          </div>

          <Section id="marginals" title={t("console.plan.marginalsTitle")} lede={t("console.plan.marginalsLede")}>
            <ul className="ks-stock m-0 grid gap-2 p-4 pl-9">
              {result.marginals.map((m) => <li key={m.resource}>{m.sentence}</li>)}
            </ul>
            {Object.keys(result.oversupplyBySkill).length ? <p className="mt-2 text-sm">{t("console.plan.oversupply", { n: Object.values(result.oversupplyBySkill).reduce((a, b) => a + Math.round(b), 0) })}</p> : null}
          </Section>

          <Section id="sign" title={t("console.plan.signTitle")}>
            <div className="max-w-xl">
              <PlanSign lgd={lgd} fy={fy} knobs={knobs} labels={t.raw("console.plan.sign.form") as never} />
            </div>
          </Section>
        </>
      ) : (
        <p className="ks-stock max-w-[62ch] p-4">{t("console.plan.infeasibleHelp")}</p>
      )}

      <NextStep
        t={t}
        sentence={ok ? t("console.plan.next") : t("console.plan.nextInfeasible")}
        actions={[
          ...(saved?.signedBy ? [{ href: `/api/export/plan?lgd=${encodeURIComponent(lgd)}&fy=${encodeURIComponent(fy)}`, label: t("console.plan.sign.form.download"), download: true, primary: true }] : []),
          { href: routes.district(lgd), label: t("console.plan.openDistrict", { district: dname }) },
        ]}
      />
    </>
  );
}

export default function PlanPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <Suspense fallback={<PageSkeleton cards={2} variant="plan" />}>
      <PlanBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}
