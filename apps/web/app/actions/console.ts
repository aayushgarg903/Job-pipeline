"use server";
// Server Actions for the official / institute console. Every input is validated here
// (system boundary). Writes go through Writers when @ks/db provides them; otherwise the
// result says plainly that it is a demo and nothing was saved.
import type { EvidenceRow, Lang } from "@ks/contracts";
import { templateNarrate } from "@ks/ai";
import { parseTable } from "@ks/ui";
import { updateTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { getReaders } from "@/lib/readers";
import { REVIEW_QUEUE } from "@/components/console/review";
import { PlanKnobs, solvePlan } from "@/components/console/plan";
import { getWriters } from "@/components/console/writers";
import { getOfficer } from "@/lib/auth";

const Id = z.string().trim().min(1).max(80).regex(/^[\w.-]+$/);
const Fy = z.string().regex(/^FY\d{2}$/);

async function lang(): Promise<Lang> {
  return (await getLocale()) === "mr" ? "mr" : "en";
}

// ---------------------------------------------------------------- evidence (lazy drawer rows)

const EvidenceRef = z.object({ kind: z.enum(["district", "skill", "course", "cell"]), id: Id, skillId: Id.optional() });

export async function loadEvidence(kind: string, id: string, skillId?: string): Promise<EvidenceRow[]> {
  const ref = EvidenceRef.parse({ kind, id, skillId });
  const r = await getReaders();
  return r.evidence(ref, 20);
}

// ---------------------------------------------------------------- sign a training plan

export interface SignState {
  status: "idle" | "signed" | "error";
  demo: boolean;
  signedBy: string | null;
  signedAt: string | null;
  message: string | null;
  pdfHref: string | null;
}

const SignInput = z.object({
  lgd: Id, fy: Fy,
  name: z.string().trim().max(80).optional(),
  seats: PlanKnobs.shape.seats, capex: PlanKnobs.shape.capex, lambda: PlanKnobs.shape.lambda,
});

export async function signPlan(_prev: SignState, form: FormData): Promise<SignState> {
  const t = await getTranslations("console.plan.sign");
  const parsed = SignInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", demo: false, signedBy: null, signedAt: null, message: t("invalid"), pdfHref: null };
  const officer = await getOfficer();
  if (!officer) return { status: "error", demo: false, signedBy: null, signedAt: null, message: t("needOfficer"), pdfHref: null };
  // The signature is the authenticated officer, never free text from the form.
  const { lgd, fy, seats, capex, lambda } = parsed.data;
  const name = officer;
  const l = await lang();
  const r = await getReaders();
  const d = await r.district(lgd);
  const districtName = d ? (l === "mr" ? d.district.nameMr : d.district.nameEn) : lgd;
  // Never trust a client-side plan: re-solve on the server from the stored input and the knobs.
  const solved = await solvePlan(lgd, fy, seats ?? null, capex ?? null, lambda ?? null, l, districtName);
  if (!solved || solved.result.status !== "optimal") {
    return { status: "error", demo: false, signedBy: null, signedAt: null, message: t("notSolvable"), pdfHref: null };
  }
  const signedAt = new Date().toISOString();
  const q = new URLSearchParams({ lgd, fy });
  if (seats !== undefined) q.set("seats", String(seats));
  if (capex !== undefined) q.set("capex", String(capex));
  if (lambda !== undefined) q.set("lambda", String(lambda));

  const w = await getWriters();
  if (!w) {
    q.set("signedBy", name);
    q.set("signedAt", signedAt);
    return { status: "signed", demo: true, signedBy: name, signedAt, message: t("demoSaved"), pdfHref: `/api/export/plan?${q}` };
  }
  try {
    await w.savePlan({ lgd, fy, input: solved.input, result: solved.result, signedBy: name });
    updateTag(`plan:${lgd}:${fy}`);
    updateTag(`district:${lgd}`);
    return { status: "signed", demo: false, signedBy: name, signedAt, message: t("saved"), pdfHref: `/api/export/plan?${q}` };
  } catch {
    return { status: "error", demo: false, signedBy: null, signedAt: null, message: t("saveFailed"), pdfHref: null };
  }
}

// ---------------------------------------------------------------- review queue

export interface ReviewState {
  status: "idle" | "done" | "error";
  decision: "approve" | "reject" | null;
  demo: boolean;
  message: string | null;
}

const ReviewInput = z.object({ id: Id, decision: z.enum(["approve", "reject"]), by: z.string().trim().max(80).optional() });

export async function resolveReviewItem(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const t = await getTranslations("console.review.result");
  const parsed = ReviewInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", decision: null, demo: false, message: t("invalid") };
  const officer = await getOfficer();
  if (!officer) return { status: "error", decision: null, demo: false, message: t("needOfficer") };
  const { id, decision } = parsed.data;
  const by = officer;
  const w = await getWriters();
  if (!w) {
    if (!REVIEW_QUEUE.some((i) => i.id === id)) return { status: "error", decision: null, demo: true, message: t("invalid") };
    return { status: "done", decision, demo: true, message: t(decision === "approve" ? "approvedDemo" : "rejectedDemo") };
  }
  try {
    await w.resolveReview({ id, decision, by: by || "officer" });
    updateTag("state");
    return { status: "done", decision, demo: false, message: t(decision === "approve" ? "approved" : "rejected") };
  } catch {
    return { status: "error", decision: null, demo: false, message: t("failed") };
  }
}

// ---------------------------------------------------------------- compare summary (CompareTray `summarize`)

const Refs = z.array(z.string().max(80)).max(4);

/** One grounded sentence about where the cards on the table differ, via templateNarrate('compare'). */
export async function summarizeTable(input: string[]): Promise<string> {
  const refs = parseTable(Refs.parse(input).join(","));
  const l = await lang();
  const t = await getTranslations("console.compare");
  const r = await getReaders();
  const places: Array<{ name: string; nameMr?: string; demand: number; supply: number; postings?: number }> = [];
  const courses: Array<{ name: string; placed: number | null; missing: number }> = [];

  for (const ref of refs) {
    const [kind, id = ""] = ref.split(":");
    if (kind === "district") {
      const s = await r.district(id);
      if (!s) continue;
      const cells = await r.districtCells(id, 50);
      places.push({
        name: s.district.nameEn, nameMr: s.district.nameMr, postings: s.postings,
        demand: cells.reduce((a, c) => a + c.demand, 0), supply: cells.reduce((a, c) => a + c.supply, 0),
      });
    } else if (kind === "skill") {
      const [s, cells] = await Promise.all([r.skill(id), r.skillCells(id)]);
      if (!s) continue;
      places.push({ name: s.labelEn, nameMr: s.labelMr ?? undefined, demand: cells.reduce((a, c) => a + c.demand, 0), supply: cells.reduce((a, c) => a + c.supply, 0) });
    } else if (kind === "course") {
      const c = await r.course(id);
      if (!c) continue;
      courses.push({ name: c.name, placed: c.health?.placementRate != null ? Math.round(c.health.placementRate * 100) : null, missing: c.health?.missingSkills.length ?? 0 });
    }
  }
  if (places.length >= 2) return templateNarrate("compare", { places }, l);
  const [a, b] = courses;
  if (a && b) {
    if (a.placed !== null && b.placed !== null) {
      return t("courses", { a: a.name, pa: a.placed, b: b.name, pb: b.placed, ma: a.missing, mb: b.missing });
    }
    return t("coursesNoPlacement", { a: a.name, b: b.name, ma: a.missing, mb: b.missing });
  }
  return templateNarrate("compare", { places }, l);
}
