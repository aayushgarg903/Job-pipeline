// Deterministic narration: the zero-API fallback and the safety net when a model
// draft fails its checks. Every number printed here comes straight from `facts`.
// Follows Design.md §1: people not percentages, say who said it, plain words,
// honest about uncertainty, end with a next step. 2-4 sentences.
import type { Lang } from "@ks/contracts";

export type NarrateKind = "pr-rationale" | "compare" | "plan-summary" | "candidate-path";

/** Fact shapes each kind understands. Extra keys are ignored; missing ones drop their sentence. */
export interface PrRationaleFacts {
  course: string; courseMr?: string;
  district: string; districtMr?: string;
  skill: string; skillMr?: string; // the main skill added
  demand?: number; supply?: number; // people, next 12 months
  employers?: number; postings?: number; // who said it
  hoursAdded?: number;
  dropSkill?: string; dropSkillMr?: string; hoursDropped?: number;
  quote?: string; quoteSource?: string; // a real evidence sentence
}
export interface CompareFacts {
  skill?: string; skillMr?: string;
  places: Array<{ name: string; nameMr?: string; demand: number; supply: number; postings?: number }>;
}
export interface PlanSummaryFacts {
  district: string; districtMr?: string; fy: string;
  status?: "optimal" | "infeasible" | "error";
  seats: number; seatsPrev?: number; expectedPlacements?: number;
  trainersToHire?: number; capexUsed?: number;
}
export interface CandidatePathFacts {
  district: string; districtMr?: string;
  role: string; roleMr?: string;
  openings?: number;
  have?: string[]; haveMr?: string[];
  gaps?: string[]; gapsMr?: string[];
  course?: string; courseMr?: string; seats?: number; institute?: string;
}

/** Below this many postings we say the signal is thin (Design.md rule 4). */
export const LOW_SIGNAL_POSTINGS = 30;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
/** Rupees the way people say them: "₹45 lakh", "₹1.2 crore". The grounding check accepts these forms. */
function inr(n: number, lang: Lang): string {
  const r1 = (x: number) => String(Math.round(x * 10) / 10);
  if (n >= 1e7) return `₹${r1(n / 1e7)} ${lang === "mr" ? "कोटी" : "crore"}`;
  if (n >= 1e5) return `₹${r1(n / 1e5)} ${lang === "mr" ? "लाख" : "lakh"}`;
  return `₹${fmt(n)}`;
}
const pick = (lang: Lang, mr: unknown, en: unknown) => (lang === "mr" ? str(mr) ?? str(en) : str(en)) ?? "";
const pickList = (lang: Lang, mr: unknown, en: unknown) => (lang === "mr" && strs(mr).length ? strs(mr) : strs(en));

function join(items: string[], lang: Lang): string {
  const and = lang === "mr" ? "आणि" : "and";
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/** Keep at most three body sentences, then the next step. */
const finish = (body: Array<string | null>, next: string) => [...body.filter((s): s is string => !!s).slice(0, 3), next].join(" ");

function prRationale(f: Record<string, unknown>, lang: Lang): string {
  const d = pick(lang, f.districtMr, f.district) || (lang === "mr" ? "या जिल्ह्या" : "this district");
  const skill = pick(lang, f.skillMr, f.skill) || (lang === "mr" ? "हे कौशल्य" : "this skill");
  const course = pick(lang, f.courseMr, f.course) || (lang === "mr" ? "हा अभ्यासक्रम" : "this course");
  const demand = num(f.demand), supply = num(f.supply), employers = num(f.employers), postings = num(f.postings);
  const added = num(f.hoursAdded), dropped = num(f.hoursDropped);
  const drop = pick(lang, f.dropSkillMr, f.dropSkill);
  const quote = str(f.quote), low = postings !== null && postings < LOW_SIGNAL_POSTINGS;

  if (lang === "mr") {
    const s1 = demand !== null && supply !== null
      ? `${d}मध्ये पुढच्या वर्षी ${skill} येणाऱ्या सुमारे ${fmt(demand)} लोकांना काम मिळू शकते, पण आपले अभ्यासक्रम फक्त सुमारे ${fmt(supply)} जणांना तयार करतील.`
      : `${d}मधील नियोक्ते ${skill} मागत आहेत, आणि ${course} मध्ये ते अजून शिकवले जात नाही.`;
    const thin = `पण आम्ही आतापर्यंत फक्त ${fmt(postings ?? 0)} नोकरीच्या जाहिराती वाचल्या आहेत, त्यामुळे हा सुरुवातीचा अंदाज समजा`;
    let s2: string | null = null;
    if (employers !== null) s2 = `${d}मधील ${fmt(employers)} नियोक्त्यांनी हे आवश्यक असल्याचे सांगितले${postings === null ? "" : low ? `, ${thin}` : `, आणि आम्ही वाचलेल्या ${fmt(postings)} नोकरीच्या जाहिरातींमध्येही हे दिसले`}.`;
    else if (quote) s2 = `एका जाहिरातीत लिहिले आहे: "${quote}".`;
    else if (postings !== null) s2 = low ? `हे काही जाहिरातींमध्ये दिसले, ${thin}.` : `आम्ही वाचलेल्या ${fmt(postings)} नोकरीच्या जाहिरातींमध्ये हे दिसले.`;
    const s3 = added !== null
      ? `या बदलात ${skill}चे ${fmt(added)} तास जोडले आहेत${drop && dropped !== null ? ` आणि ${drop}चे ${fmt(dropped)} तास कमी केले आहेत, त्यामुळे अभ्यासक्रमाची लांबी जवळपास तेवढीच राहते` : ""}.`
      : null;
    return finish([s1, s2, s3], "सर्वेक्षणात उत्तर दिलेल्या स्थानिक नियोक्त्यांना हा बदल पाठवा आणि त्यांची मान्यता किंवा सूचना विचारा.");
  }

  const s1 = demand !== null && supply !== null
    ? `About ${fmt(demand)} people in ${d} could be hired next year for work that needs ${skill}, and local courses will train about ${fmt(supply)}.`
    : `Employers in ${d} are asking for ${skill}, and ${course} does not teach it yet.`;
  const thin = `but we have only read ${fmt(postings ?? 0)} job posts so far, so treat this as an early signal`;
  let s2: string | null = null;
  if (employers !== null) s2 = `${fmt(employers)} employers in ${d} told us it is a must-have${postings === null ? "" : low ? `, ${thin}` : `, and it came up in ${fmt(postings)} job posts we read`}.`;
  else if (quote) s2 = `One job post says: "${quote}".`;
  else if (postings !== null) s2 = low ? `It came up in job posts from ${d}, ${thin}.` : `It came up in ${fmt(postings)} job posts we read from ${d}.`;
  const s3 = added !== null
    ? `This change adds ${fmt(added)} hours of ${skill}${drop && dropped !== null ? ` and cuts ${fmt(dropped)} hours of ${drop}, so the course stays about the same length` : ""}.`
    : null;
  return finish([s1, s2, s3], "Send it to the local employers who answered the survey and ask them to endorse it or suggest changes.");
}

function compare(f: Record<string, unknown>, lang: Lang): string {
  const places = (Array.isArray(f.places) ? f.places : [])
    .map((p) => p as Record<string, unknown>)
    .filter((p) => str(p.name) && num(p.demand) !== null && num(p.supply) !== null);
  const skill = pick(lang, f.skillMr, f.skill);
  const [a, b] = places;
  const name = (p: Record<string, unknown>) => pick(lang, p.nameMr, p.name);
  if (!a || !b) {
    return lang === "mr"
      ? "तुलना करण्यासाठी किमान दोन ठिकाणांची माहिती लागते. टेबलवर आणखी एक कार्ड ठेवा."
      : "We need at least two places with numbers to compare. Put another card on the table.";
  }
  const gap = (p: Record<string, unknown>) => num(p.demand)! - num(p.supply)!;
  const widest = [...places].sort((x, y) => gap(y) - gap(x))[0]!;
  const thin = places.find((p) => num(p.postings) !== null && num(p.postings)! < LOW_SIGNAL_POSTINGS);

  if (lang === "mr") {
    const what = skill ? `${skill} येणाऱ्या ` : "";
    const s1 = `${name(a)}मध्ये पुढच्या वर्षी ${what}सुमारे ${fmt(num(a.demand)!)} लोकांना काम मिळू शकते आणि अभ्यासक्रम ${fmt(num(a.supply)!)} जणांना तयार करतील; ${name(b)}मध्ये हे ${fmt(num(b.demand)!)} विरुद्ध ${fmt(num(b.supply)!)} आहे.`;
    const s2 = gap(widest) > 0 ? `सर्वात जास्त तूट ${name(widest)}मध्ये आहे.` : "दोन्ही ठिकाणी प्रशिक्षण मागणीपेक्षा जास्त आहे.";
    const s3 = thin ? `${name(thin)}मधून आम्ही फक्त ${fmt(num(thin.postings)!)} जाहिराती पाहिल्या आहेत, त्यामुळे ती बाजू नियोक्त्यांनी सांगितलेल्या माहितीवर जास्त अवलंबून आहे.` : null;
    return finish([s1, s2, s3], "कोणते अभ्यासक्रम ही तूट भरू शकतात ते पाहण्यासाठी जिल्ह्याचे कार्ड उघडा.");
  }
  const what = skill ? ` for work that needs ${skill}` : "";
  const s1 = `In ${name(a)}, about ${fmt(num(a.demand)!)} people could be hired${what} next year and courses will train ${fmt(num(a.supply)!)}; in ${name(b)} it is ${fmt(num(b.demand)!)} against ${fmt(num(b.supply)!)}.`;
  const s2 = gap(widest) > 0 ? `The shortfall is widest in ${name(widest)}.` : "Both places are training more people than employers need.";
  const s3 = thin ? `We have only seen ${fmt(num(thin.postings)!)} job posts from ${name(thin)}, so that side leans on what employers told us.` : null;
  return finish([s1, s2, s3], "Open the district cards to see which courses could close the gap.");
}

function planSummary(f: Record<string, unknown>, lang: Lang): string {
  const d = pick(lang, f.districtMr, f.district);
  const fy = str(f.fy) ?? "";
  const seats = num(f.seats), prev = num(f.seatsPrev), placed = num(f.expectedPlacements);
  const trainers = num(f.trainersToHire), capex = num(f.capexUsed);
  if (f.status === "infeasible" || f.status === "error" || seats === null) {
    return lang === "mr"
      ? `${d}साठी ${fy} चा आराखडा दिलेल्या जागा आणि निधीच्या मर्यादेत बसत नाही. निधी थोडा वाढवून किंवा एखादा अभ्यासक्रम वगळून पुन्हा चालवा.`
      : `The ${fy} plan for ${d} does not fit inside the seat and money limits you set. Try raising the budget or dropping a course, then run it again.`;
  }
  if (lang === "mr") {
    const s1 = `${fy} साठी हा आराखडा ${d}मध्ये ${fmt(seats)} जणांना प्रशिक्षण देतो${prev !== null ? `; यंदा ही संख्या ${fmt(prev)} आहे` : ""}.`;
    const s2 = placed !== null ? `त्यापैकी सुमारे ${fmt(placed)} जणांना नोकरी लागेल असा आमचा अंदाज आहे.` : null;
    const s3 = trainers !== null || capex !== null
      ? `यासाठी ${[trainers !== null ? `${fmt(trainers)} प्रशिक्षकांची भरती` : null, capex !== null ? `उपकरणांवर ${inr(capex, lang)} खर्च` : null].filter(Boolean).join(" आणि ")} लागेल.`
      : null;
    return finish([s1, s2, s3], "ITI प्राचार्यांशी हा आराखडा तपासा आणि मग त्यावर सही करा.");
  }
  const dir = prev === null ? "" : seats >= prev ? `, up from ${fmt(prev)} this year` : `, down from ${fmt(prev)} this year`;
  const s1 = `For ${fy}, this plan trains ${fmt(seats)} people in ${d}${dir}.`;
  const s2 = placed !== null ? `We expect about ${fmt(placed)} of them to be placed in jobs.` : null;
  const needs = [trainers !== null ? `hire ${fmt(trainers)} trainers` : null, capex !== null ? `spend ${inr(capex, lang)} on equipment` : null].filter(Boolean);
  const s3 = needs.length ? `To do it, the district needs to ${needs.join(" and ")}.` : null;
  return finish([s1, s2, s3], "Check it with the ITI principals, then sign the plan.");
}

function candidatePath(f: Record<string, unknown>, lang: Lang): string {
  const d = pick(lang, f.districtMr, f.district);
  const role = pick(lang, f.roleMr, f.role);
  const openings = num(f.openings), seats = num(f.seats);
  const have = pickList(lang, f.haveMr, f.have), gaps = pickList(lang, f.gapsMr, f.gaps);
  const course = pick(lang, f.courseMr, f.course), inst = str(f.institute);
  if (lang === "mr") {
    const s1 = `${d}मध्ये तुमची कौशल्ये तुम्हाला ${role} या कामापर्यंत नेऊ शकतात${openings !== null ? `; पुढच्या वर्षी यासाठी सुमारे ${fmt(openings)} जणांना काम मिळू शकते` : ""}.`;
    const s2 = have.length ? `तुम्हाला आधीच ${join(have, lang)} येते.` : null;
    const s3 = gaps.length
      ? `तिथे पोहोचण्यासाठी ${join(gaps, lang)} शिका${course ? `; ${course} मध्ये हे शिकवले जाते${seats !== null ? ` आणि ${fmt(seats)} जागा रिकाम्या आहेत` : ""}` : ""}.`
      : null;
    return finish([s1, s2, s3], inst ? `पुढच्या बॅचबद्दल ${inst} येथे चौकशी करा.` : "हा मार्ग जतन करा आणि जवळच्या ITI मध्ये पुढच्या बॅचबद्दल विचारा.");
  }
  const s1 = `Here's where your skills can take you in ${d}: ${role}${openings !== null ? `, with about ${fmt(openings)} people likely to be hired for it next year` : ""}.`;
  const s2 = have.length ? `You already have ${join(have, lang)}.` : null;
  const s3 = gaps.length
    ? `To get there, learn ${join(gaps, lang)}${course ? `, which ${course} teaches${seats !== null ? ` and has ${fmt(seats)} seats open` : ""}` : ""}.`
    : null;
  return finish([s1, s2, s3], inst ? `Ask at ${inst} about the next batch.` : "Save this path and ask your nearest ITI about the next batch.");
}

/** Deterministic, grounded narration for every kind in en and mr. Needs no API. */
export function templateNarrate(kind: NarrateKind, facts: Record<string, unknown>, lang: Lang): string {
  switch (kind) {
    case "pr-rationale": return prRationale(facts, lang);
    case "compare": return compare(facts, lang);
    case "plan-summary": return planSummary(facts, lang);
    case "candidate-path": return candidatePath(facts, lang);
  }
}
