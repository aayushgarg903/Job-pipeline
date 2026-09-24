// GET /api/export/[kind]
//   districts | skills | courses  -> CSV (UTF-8 with BOM so Excel keeps Marathi names)
//   plan?lgd=&fy=[&seats=&capex=&lambda=&signedBy=&signedAt=&lang=] -> A4 PDF of the training plan
// A plan signed through Writers carries its stored signature; otherwise the PDF says plainly
// that the signature is a demo and was not recorded.
import type { Lang } from "@ks/contracts";
import { templateNarrate } from "@ks/ai";
import { rupees } from "@ks/core";
import { LOCALE_COOKIE, formatDate, formatNumber } from "@ks/ui";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { parseKnobs, planTotals, solvePlan } from "@/components/console/plan";
import { renderPlanPdf } from "@/components/console/pdf/PlanPdf";
import { getReaders } from "@/lib/readers";

type Ctx = { params: Promise<{ kind: string }> };

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything that needs it; neutralise spreadsheet formula injection.
  const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const toCsv = (header: string[], rows: unknown[][]) => "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

function csv(name: string, body: string) {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kaushal-setu-${name}.csv"`,
      "cache-control": "private, max-age=300",
    },
  });
}

async function districtsCsv() {
  const r = await getReaders();
  const ds = await r.districts();
  return csv("districts", toCsv(
    ["lgd", "name_en", "name_mr", "division", "mismatch_index", "coverage", "top_shortage_skill", "people_short", "top_surplus_skill", "people_surplus", "job_posts", "new_udyam_12m", "demo_data"],
    ds.map((d) => [d.district.lgd, d.district.nameEn, d.district.nameMr, d.district.division, d.mismatch, d.coverage, d.topShortage?.skillId ?? "", d.topShortage?.gap ?? "", d.topSurplus?.skillId ?? "", d.topSurplus ? Math.abs(d.topSurplus.gap) : "", d.postings, d.udyamNew12m, d.provenance.isDemo]),
  ));
}

async function skillsCsv() {
  const r = await getReaders();
  const skills = await r.searchSkills("", 500);
  const rows = await Promise.all(skills.map(async (s) => {
    const cells = await r.skillCells(s.id);
    const demand = cells.reduce((a, c) => a + c.demand, 0);
    const supply = cells.reduce((a, c) => a + c.supply, 0);
    return [s.id, s.labelEn, s.labelMr ?? "", s.kind, cells.length, demand, supply, demand - supply];
  }));
  return csv("skills", toCsv(["skill_id", "label_en", "label_mr", "kind", "districts", "hires_needed_12m", "trained_locally_12m", "people_short"], rows));
}

async function coursesCsv() {
  const r = await getReaders();
  const cs = await r.courses({ limit: 5000 });
  return csv("courses", toCsv(
    ["course_id", "code", "name", "kind", "institution", "lgd", "seats", "hours", "health_total", "relevance", "outcomes", "currency", "validation", "flags", "placement_rate_6m", "missing_skills", "demo_data"],
    cs.map((c) => [c.id, c.code, c.name, c.kind, c.institutionName, c.lgd, c.seats, c.durationHours, c.health?.total ?? "", c.health?.relevance ?? "", c.health?.outcomes ?? "", c.health?.currency ?? "", c.health?.validation ?? "", c.health?.flags.join(" ") ?? "", c.health?.placementRate ?? "", c.health?.missingSkills.join(" ") ?? "", c.isDemo]),
  ));
}

const PlanQuery = z.object({ lgd: z.string().regex(/^[0-9]{1,6}$/), fy: z.string().regex(/^FY\d{2}$/i), signedBy: z.string().trim().max(80).optional(), signedAt: z.iso.datetime({ offset: true }).optional().catch(undefined), lang: z.enum(["en", "mr"]).optional().catch(undefined) });

async function planPdf(request: Request) {
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams);
  const q = PlanQuery.safeParse(sp);
  if (!q.success) return new Response("Expected ?lgd=<LGD code>&fy=FY27", { status: 400 });
  const fy = q.data.fy.toUpperCase();
  const cookieLang = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(mr|en)`).exec(request.headers.get("cookie") ?? "")?.[1] as Lang | undefined;
  const lang: Lang = q.data.lang ?? cookieLang ?? "en";
  const t = await getTranslations({ locale: lang, namespace: "console.pdf" });
  const r = await getReaders();
  const [d, saved] = await Promise.all([r.district(q.data.lgd), r.savedPlan(q.data.lgd, fy)]);
  if (!d) return new Response("Unknown district", { status: 404 });
  const name = lang === "mr" ? d.district.nameMr : d.district.nameEn;
  const knobs = parseKnobs(sp);
  const solved = await solvePlan(q.data.lgd, fy, knobs.seats ?? null, knobs.capex ?? null, knobs.lambda ?? null, lang, name);
  if (!solved || solved.result.status !== "optimal") return new Response("No solvable plan for this district and year", { status: 404 });
  const { input, result } = solved;
  const tot = planTotals(input, result);

  const stored = saved?.signedBy ? { by: saved.signedBy, at: saved.signedAt } : null;
  const demoSig = !stored && q.data.signedBy ? { by: q.data.signedBy, at: q.data.signedAt ?? null } : null;
  const sig = stored ?? demoSig;
  const narrative = templateNarrate("plan-summary", {
    district: d.district.nameEn, districtMr: d.district.nameMr, fy, status: result.status, seats: tot.seats, seatsPrev: tot.seatsPrev,
    expectedPlacements: Math.round(result.expectedPlacements), trainersToHire: tot.trainers, capexUsed: result.capexUsed,
  }, lang);

  const buf = await renderPlanPdf({
    lang,
    gov: t("gov"),
    title: t("title", { district: name, fy }),
    subtitle: t("subtitle", { seats: formatNumber(tot.seats, lang), placed: formatNumber(Math.round(result.expectedPlacements), lang) }),
    narrative,
    columns: { course: t("course"), before: t("before"), after: t("after"), batches: t("batches") },
    rows: result.rows.map((x) => ({ name: x.name, before: formatNumber(x.seatsPrev, lang), after: formatNumber(x.seats, lang), batches: formatNumber(x.batches, lang) })),
    sections: [
      { heading: t("trainers"), lines: Object.entries(result.trainersToHire).filter(([, n]) => n > 0).map(([qq, n]) => t("trainerRow", { n, q: qq })).concat(tot.trainers ? [] : [t("none")]) },
      { heading: t("equipment"), lines: tot.equipment.map((e) => t("equipmentRow", { n: e.sets, course: e.name, cost: rupees(e.cost, { lang }) })).concat([t("capex", { used: rupees(result.capexUsed, { lang }), budget: rupees(input.capexBudget, { lang }) })]) },
      { heading: t("marginals"), lines: result.marginals.map((m) => m.sentence) },
    ],
    signature: {
      heading: t("signature"),
      line: sig ? t("signedBy", { name: sig.by, date: sig.at ? formatDate(sig.at, lang) : "—" }) : t("unsigned"),
      note: demoSig ? t("demoSignature") : null,
    },
    footer: t("footer", { date: formatDate(new Date().toISOString(), lang) }),
    specimen: d.provenance.isDemo || demoSig ? t("specimen") : null,
  });
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="training-plan-${q.data.lgd}-${fy}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}

export async function GET(request: Request, { params }: Ctx) {
  const { kind } = await params;
  switch (kind) {
    case "districts": return districtsCsv();
    case "skills": return skillsCsv();
    case "courses": return coursesCsv();
    case "plan": return planPdf(request);
    default: return new Response("Unknown export. Use districts, skills, courses or plan.", { status: 404 });
  }
}
