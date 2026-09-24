// Architecture §6.4: Curriculum Pull Request generator. Deterministic: the diff, target and
// deltas are computed here from numbers; an LLM may later rewrite `rationale` from these same
// numbers but can never add a skill that isn't in the diff.

import type { Course, CourseHealth, CurriculumPr, DiffLine, Lang, PrTarget, SkillId } from "@ks/contracts";
import { aboutNum, formatIndian, mrLocative, mrPeopleObj, peopleCount, capitalize, type Digits } from "./humanize";
import type { TargetSkillDemand } from "./health";

export const HOURS_TOLERANCE = 0.1; // total hours stay within ±10% of the QP budget

export interface SkillRequirement {
  hours?: number; // module hours when added (default 30)
  module?: string; // module name; defaults to the skill label
  trainerQualification?: string; // QP "Trainer Prerequisites"
  equipment?: Array<{ item: string; qty: number }>; // DGT/NCVT tool & equipment list
}

export interface PrInput {
  course: Course;
  health: Pick<CourseHealth, "missingSkills" | "decliningSkills" | "unassessedSkills">;
  qpBudgetHours: number;
  targetSkills: readonly TargetSkillDemand[]; // catchment demand (people) for the target occupation
  supplyBySkill?: Record<SkillId, number>; // people already trained in the skill here
  decliningQuarters?: Record<SkillId, number>; // how many quarters the decline has run (for reasons)
  requirements?: Record<SkillId, SkillRequirement>;
  trainerQualificationsHeld?: readonly string[];
  equipmentStock?: Record<string, number>;
  districtName: string; // in `lang`
  skillLabels?: Record<SkillId, string>; // in `lang`
  openedAt: string; // ISO; passed in so the output is deterministic
  id?: string;
  maxNewSkills?: number; // default 5
  defaultModuleHours?: number; // default 30
  lang?: Lang;
  digits?: Digits;
}

/** NCVT ITI trades and SSC-owned PMKVY QPs can't be rewritten by the state; state/MSBTE courses can. */
export function prTarget(kind: Course["kind"], hasDropsOrResizes: boolean): PrTarget {
  if (kind === "state" || kind === "polytechnic") return "state-course";
  return hasDropsOrResizes ? "recommendation" : "add-on-module";
}

interface Line {
  op: DiffLine["op"];
  skillId: SkillId;
  module: string;
  before: number;
  after: number;
  demand: number;
  why: "added" | "dropped" | "declined" | "trimmed" | "grown" | "kept";
}

export function generateCurriculumPr(input: PrInput): CurriculumPr {
  const lang = input.lang ?? "en";
  const mr = lang === "mr";
  const o = { lang, digits: input.digits };
  const label = (id: SkillId) => input.skillLabels?.[id] ?? id;
  const req = (id: SkillId) => input.requirements?.[id] ?? {};
  const demandOf = new Map<SkillId, number>();
  for (const t of input.targetSkills) demandOf.set(t.skillId, Math.max(demandOf.get(t.skillId) ?? 0, t.demand));
  const B = Math.max(1, input.qpBudgetHours);
  const lo = Math.ceil(B * (1 - HOURS_TOLERANCE));
  const hi = Math.floor(B * (1 + HOURS_TOLERANCE));

  // 1. Start from the course as taught (one line per skill).
  const lines: Line[] = [];
  for (const s of input.course.skills) {
    const existing = lines.find((l) => l.skillId === s.skillId);
    if (existing) {
      existing.before += s.hours;
      existing.after += s.hours;
      continue;
    }
    lines.push({
      op: "keep", skillId: s.skillId, module: req(s.skillId).module ?? label(s.skillId),
      before: s.hours, after: s.hours, demand: demandOf.get(s.skillId) ?? 0, why: "kept",
    });
  }

  // 2. Stale skills: drop when nobody hiring here needs them, halve when some still do.
  const declining = new Set(input.health.decliningSkills);
  for (const l of lines) {
    if (!declining.has(l.skillId)) continue;
    if (l.demand > 0) Object.assign(l, { op: "resize", after: Math.round(l.before / 2), why: "declined" });
    else Object.assign(l, { op: "drop", after: 0, why: "dropped" });
  }

  // 3. Missing skills, biggest people-gap first, while the hours can still be made to fit.
  const total = () => lines.reduce((a, l) => a + l.after, 0);
  // Hours that step 4 could free: half of undemanded modules, 15% of demanded ones.
  const trimmable = () =>
    lines.filter((l) => l.op === "keep").reduce((a, l) => a + l.after * (l.demand <= 0 ? 0.5 : 0.15), 0);
  const supply = (id: SkillId) => input.supplyBySkill?.[id] ?? 0;
  const missing = [...new Set(input.health.missingSkills)]
    .filter((id) => !lines.some((l) => l.skillId === id))
    .sort((a, b) => (demandOf.get(b) ?? 0) - supply(b) - ((demandOf.get(a) ?? 0) - supply(a)) || (a < b ? -1 : 1))
    .slice(0, input.maxNewSkills ?? 5);
  for (const id of missing) {
    const h = Math.max(1, Math.round(req(id).hours ?? input.defaultModuleHours ?? 30));
    if (total() + h > hi + trimmable()) continue;
    lines.push({ op: "add", skillId: id, module: req(id).module ?? label(id), before: 0, after: h, demand: demandOf.get(id) ?? 0, why: "added" });
  }

  // 4. Over budget: trim undemanded modules (to half), then everything kept, proportionally.
  if (total() > hi) {
    for (const l of lines.filter((x) => x.op === "keep" && x.demand <= 0).sort((a, b) => b.after - a.after)) {
      const excess = total() - hi;
      if (excess <= 0) break;
      const cut = Math.min(excess, Math.floor(l.after / 2));
      if (cut > 0) Object.assign(l, { op: "resize", after: l.after - cut, why: "trimmed" });
    }
  }
  if (total() > hi) {
    const flexible = lines.filter((l) => (l.op === "keep" || l.why === "trimmed") && l.after > 1);
    const flexHours = flexible.reduce((a, l) => a + l.after, 0);
    const excess = total() - hi;
    if (flexHours > 0) {
      for (const l of flexible) {
        const next = Math.max(1, Math.floor(l.after - (excess * l.after) / flexHours));
        if (next < l.after) Object.assign(l, { op: "resize", after: next, why: "trimmed" });
      }
    }
  }
  // 5. Under budget: grow demanded modules (kept and added) in proportion to demand.
  if (total() < lo) {
    const growable = lines.filter((l) => l.after > 0 && l.demand > 0 && l.why !== "declined").sort((a, b) => b.demand - a.demand);
    const dsum = growable.reduce((a, l) => a + l.demand, 0);
    const deficit = lo - total();
    if (dsum > 0) {
      let given = 0;
      growable.forEach((l, i) => {
        const extra = i === growable.length - 1 ? deficit - given : Math.floor((deficit * l.demand) / dsum);
        if (extra <= 0) return;
        l.after += extra;
        given += extra;
        if (l.op === "keep") Object.assign(l, { op: "resize", why: "grown" });
      });
    }
  }

  // ---- reasons ----
  const where = input.districtName;
  const q = (id: SkillId) => input.decliningQuarters?.[id] ?? 6;
  const reason = (l: Line): string => {
    const skill = label(l.skillId);
    const bh = formatIndian(l.before, o);
    const ah = formatIndian(l.after, o);
    const budget = formatIndian(B, o);
    const unassessed = input.health.unassessedSkills.includes(l.skillId);
    switch (l.why) {
      case "added": {
        const s = supply(l.skillId);
        if (mr) {
          const head = `पुढील वर्षी ${mrLocative(where)} ${mrPeopleObj(l.demand, o)} "${skill}" लागेल`;
          return s >= 1 ? `${head}; इथले अभ्यासक्रम यात फक्त ${mrPeopleObj(s, o)} प्रशिक्षण देतात.` : `${head}; इथे अजून कोणताही अभ्यासक्रम हे शिकवत नाही.`;
        }
        const head = `${capitalize(peopleCount(l.demand, o))} in ${where} will need ${skill} next year`;
        return s >= 1 ? `${head}; courses here train only ${aboutNum(s, o)} in it.` : `${head}; no course here teaches it yet.`;
      }
      case "dropped":
        return mr
          ? `पुढील वर्षी इथे नोकरीला लागणाऱ्या कोणालाही "${skill}" लागणार नाही, आणि सलग ${formatIndian(q(l.skillId), o)} तिमाही याची मागणी घटत आहे.`
          : `No one hired here next year is expected to need ${skill}, and demand has fallen for ${q(l.skillId)} quarters in a row.`;
      case "declined":
        return mr
          ? `${bh} वरून ${ah} तास केले: इथे अजूनही ${mrPeopleObj(l.demand, o)} याची गरज आहे, पण सलग ${formatIndian(q(l.skillId), o)} तिमाही मागणी घटत आहे.`
          : `Cut from ${bh} to ${ah} hours: ${peopleCount(l.demand, o)} here still need it, but demand has fallen for ${q(l.skillId)} quarters in a row.`;
      case "trimmed":
        return mr
          ? `अभ्यासक्रम ${budget} तासांच्या मर्यादेच्या 10% आत ठेवण्यासाठी ${bh} वरून ${ah} तास केले; इथे ${l.demand > 0 ? mrPeopleObj(l.demand, o) : "कोणालाही"} याची गरज ${l.demand > 0 ? "आहे" : "नाही"}.`
          : `Trimmed from ${bh} to ${ah} hours to keep the course within 10% of its ${budget}-hour budget; ${l.demand > 0 ? `${peopleCount(l.demand, o)} here need it` : "no one hiring here asks for it"}.`;
      case "grown":
        return mr
          ? `${bh} वरून ${ah} तास केले: इथे ${mrPeopleObj(l.demand, o)} याची गरज आहे आणि ${budget} तासांच्या मर्यादेत जागा होती.`
          : `Extended from ${bh} to ${ah} hours: ${peopleCount(l.demand, o)} here need it, and the ${budget}-hour budget had room.`;
      default: {
        if (l.demand <= 0)
          return mr
            ? `${ah} तास तसेच ठेवले; इथल्या कंपन्यांनी याची मागणी केलेली नाही, पण याची मागणी घटतही नाही.`
            : `Kept at ${ah} hours; employers here haven't asked for it, but it isn't declining either.`;
        const base = mr ? `पुढील वर्षी इथे ${mrPeopleObj(l.demand, o)} याची गरज आहे` : `Still needed by ${peopleCount(l.demand, o)} hired here next year`;
        if (unassessed) return mr ? `${base}, पण याची परीक्षा कधीच घेतली जात नाही: प्रात्यक्षिक चाचणी जोडा.` : `${base}, but it is never assessed: add a practical test.`;
        return `${base}.`;
      }
    }
  };

  const diff: DiffLine[] = lines.map((l) => ({
    op: l.op, module: l.module, skillId: l.skillId, hoursBefore: l.before, hoursAfter: l.after, reason: reason(l),
  }));
  const target = prTarget(input.course.kind, lines.some((l) => l.op === "drop" || l.op === "resize"));

  // Trainer and equipment deltas for the added skills.
  const held = new Set(input.trainerQualificationsHeld ?? []);
  const trainerNeed = new Map<string, number>();
  const equipNeed = new Map<string, number>();
  for (const l of lines.filter((x) => x.op === "add")) {
    const r = req(l.skillId);
    if (r.trainerQualification && !held.has(r.trainerQualification)) trainerNeed.set(r.trainerQualification, 1);
    for (const e of r.equipment ?? []) equipNeed.set(e.item, Math.max(equipNeed.get(e.item) ?? 0, e.qty));
  }
  const trainerDelta = [...trainerNeed].map(([qualification, count]) => ({ qualification, count })).sort((a, b) => (a.qualification < b.qualification ? -1 : 1));
  const equipmentDelta = [...equipNeed]
    .map(([item, qty]) => ({ item, qty: qty - (input.equipmentStock?.[item] ?? 0) }))
    .filter((e) => e.qty > 0)
    .sort((a, b) => (a.item < b.item ? -1 : 1));

  const adds = lines.filter((l) => l.op === "add").sort((a, b) => b.demand - a.demand);
  const drops = lines.filter((l) => l.op === "drop").length;
  const after = total();
  const approver = {
    "state-course": mr ? "राज्य मंडळाकडे (MSBSVET) मंजुरीसाठी जाईल" : "goes to the state board (MSBSVET) for approval",
    "add-on-module": mr ? "ITI ची संस्था व्यवस्थापन समिती (IMC) हा अतिरिक्त मॉड्यूल म्हणून चालवू शकते" : "can run as an add-on module approved by the ITI's Institute Management Committee",
    recommendation: mr ? "DGT / संबंधित सेक्टर स्किल कौन्सिलकडे पुराव्यांसह शिफारस म्हणून जाईल" : "goes to DGT and the Sector Skill Council as a recommendation, with the evidence attached",
  }[target];
  const sentences: string[] = [];
  const top = adds[0];
  if (mr) {
    if (top) sentences.push(`हा प्रस्ताव ${formatIndian(adds.length, o)} ${adds.length === 1 ? "नवे कौशल्य" : "नवी कौशल्ये"} जोडतो; त्यातील सर्वात महत्त्वाचे "${label(top.skillId)}" पुढील वर्षी ${mrLocative(where)} ${mrPeopleObj(top.demand, o)} लागेल.`);
    if (drops > 0) sentences.push(drops === 1 ? "कंपन्या आता मागत नाहीत असे 1 कौशल्य काढले आहे." : `कंपन्या आता मागत नाहीत अशी ${formatIndian(drops, o)} कौशल्ये काढली आहेत.`);
    sentences.push(`एकूण ${formatIndian(after, o)} तास (मर्यादा ${formatIndian(B, o)} तास); हा प्रस्ताव ${approver}.`);
  } else {
    if (top) sentences.push(`This adds ${adds.length} ${adds.length === 1 ? "skill" : "skills"} employers in ${where} are asking for; the top one, ${label(top.skillId)}, will be needed by ${peopleCount(top.demand, o)} next year.`);
    if (drops > 0) sentences.push(`It drops ${drops} ${drops === 1 ? "skill" : "skills"} employers no longer ask for.`);
    sentences.push(`The course comes to ${formatIndian(after, o)} hours against a ${formatIndian(B, o)}-hour budget, and it ${approver}.`);
  }

  return {
    id: input.id ?? `pr-${input.course.id}-${input.openedAt.slice(0, 10)}`,
    courseId: input.course.id,
    target,
    status: "draft",
    diff,
    rationale: sentences.join(" "),
    endorsements: 0,
    changeRequests: 0,
    openedAt: input.openedAt,
    adoptedAt: null,
    trainerDelta,
    equipmentDelta,
  };
}
