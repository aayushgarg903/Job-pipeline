// People, not percentages. Helpers that turn engine numbers into plain English and Marathi.
// Marathi uses Latin digits by default (they read cleanly next to charts); pass
// `digits: "deva"` for Devanagari numerals in formal documents.

import type { Lang } from "@ks/contracts";

export type Digits = "latin" | "deva";
export interface FormatOptions {
  lang?: Lang;
  digits?: Digits;
}

const DEVA = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toDevanagariDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => DEVA[Number(d)] as string);
}

const withDigits = (s: string, o: FormatOptions) => (o.digits === "deva" ? toDevanagariDigits(s) : s);

/** Indian digit grouping: 1234567 → "12,34,567". Decimals are kept as given. */
export function formatIndian(n: number, opts: FormatOptions & { decimals?: number } = {}): string {
  if (!Number.isFinite(n)) return "–";
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(opts.decimals ?? 0);
  const [int, frac] = fixed.split(".") as [string, string | undefined];
  let grouped = int;
  if (int.length > 3) {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = `${rest},${last3}`;
  }
  return withDigits(`${neg ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`, opts);
}

const trimDecimal = (x: number) => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, "");

/** 1,20,000 → "1.2 lakh" / "1.2 लाख"; 3,40,00,000 → "3.4 crore" / "3.4 कोटी"; smaller numbers grouped. */
export function compactIndian(n: number, opts: FormatOptions = {}): string {
  const mr = opts.lang === "mr";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e7) return withDigits(`${sign}${trimDecimal(a / 1e7)}`, opts) + (mr ? " कोटी" : " crore");
  if (a >= 1e5) return withDigits(`${sign}${trimDecimal(a / 1e5)}`, opts) + (mr ? " लाख" : " lakh");
  return formatIndian(Math.round(n), opts);
}

/** "₹12 lakh", "₹45,000", "₹1.5 crore". */
export function rupees(n: number, opts: FormatOptions = {}): string {
  return `₹${compactIndian(n, opts)}`;
}

/** Rounds a people-count the way a person would say it: 7, 35, 140, 1,250, 12,300. */
export function roundPeople(n: number): number {
  const a = Math.abs(n);
  const step = a < 20 ? 1 : a < 100 ? 5 : a < 1000 ? 10 : a < 10000 ? 50 : 100;
  return Math.sign(n) * Math.round(a / step) * step;
}

/** "about 140 people" / "सुमारे 140 जण". Exact for small counts. */
export function peopleCount(n: number, opts: FormatOptions = {}): string {
  const r = roundPeople(n);
  const num = formatIndian(r, opts);
  const approx = Math.abs(n - r) > 0.05 || Math.abs(n) >= 20;
  if (opts.lang === "mr") return `${approx ? "सुमारे " : ""}${num} ${r === 1 ? "व्यक्ती" : "जण"}`;
  return `${approx ? "about " : ""}${num} ${r === 1 ? "person" : "people"}`;
}

/** "3 of 5" / "5 पैकी 3". */
export function countOf(k: number, n: number, opts: FormatOptions = {}): string {
  const a = formatIndian(k, opts);
  const b = formatIndian(n, opts);
  return opts.lang === "mr" ? `${b} पैकी ${a}` : `${a} of ${b}`;
}

// Irregular Marathi locatives for district names ("in Pune" → "पुण्यात", not "पुणेमध्ये").
const MR_LOCATIVE: Record<string, string> = {
  पुणे: "पुण्यात",
  ठाणे: "ठाण्यात",
  मुंबई: "मुंबईत",
  "मुंबई उपनगर": "मुंबई उपनगरात",
  सातारा: "साताऱ्यात",
  सांगली: "सांगलीत",
  कोल्हापूर: "कोल्हापुरात",
  सोलापूर: "सोलापुरात",
  नागपूर: "नागपुरात",
  वर्धा: "वर्ध्यात",
  भंडारा: "भंडाऱ्यात",
  जळगाव: "जळगावात",
  रायगड: "रायगडात",
  बीड: "बीडमध्ये",
};

/** "नाशिक" → "नाशिकमध्ये", "पुणे" → "पुण्यात". */
export function mrLocative(name: string): string {
  return MR_LOCATIVE[name] ?? `${name}मध्ये`;
}

/** "नाशिक" → "नाशिकमधील" (attributive "of/in Nashik"). */
export function mrAttributive(name: string): string {
  const loc = MR_LOCATIVE[name];
  if (loc && loc.endsWith("ात")) return `${loc.slice(0, -2)}ातील`;
  if (loc && loc.endsWith("त")) return `${loc.slice(0, -1)}तील`;
  return `${name}मधील`;
}

export interface PeopleSentenceInput {
  gap: { demand: number; supply: number };
  district: string; // already in the target language (District.nameEn / nameMr)
  occupationLabel: string; // plural phrase in the target language: "solar technicians" / "सोलर तंत्रज्ञ"
  lang?: Lang;
  providers?: string; // who trains: default "ITIs" / "ITI"
  digits?: Digits;
}

/**
 * "About 140 people in Nashik could be hired as solar technicians next year; ITIs here will train about 35."
 * "नाशिकमध्ये पुढील वर्षी सुमारे 140 जणांना सोलर तंत्रज्ञ म्हणून नोकरी मिळू शकते; इथल्या ITI सुमारे 35 जणांना प्रशिक्षण देतील."
 */
export function peopleSentence(input: PeopleSentenceInput): string {
  const { demand, supply } = input.gap;
  const o: FormatOptions = { lang: input.lang ?? "en", digits: input.digits };
  const d = roundPeople(demand);
  const s = roundPeople(supply);
  if (o.lang === "mr") {
    const prov = input.providers ?? "ITI";
    const where = mrLocative(input.district);
    const first =
      d < 1
        ? `${where} पुढील वर्षी ${input.occupationLabel} म्हणून फारशा नोकऱ्या अपेक्षित नाहीत`
        : `${where} पुढील वर्षी ${mrPeopleObj(demand, o)} ${input.occupationLabel} म्हणून नोकरी मिळू शकते`;
    if (s < 1) return `${first}; इथल्या कोणत्याही ${prov}मध्ये याचे प्रशिक्षण अजून दिले जात नाही.`;
    const second = `इथल्या ${prov} ${mrPeopleObj(supply, o)} प्रशिक्षण देतील`;
    if (d >= 1 && supply > 1.25 * demand) return `${first}; ${second}, त्यामुळे अनेकांना इतरत्र संधी शोधावी लागेल.`;
    return `${first}; ${second}.`;
  }
  const prov = input.providers ?? "ITIs";
  const first =
    d < 1
      ? `Hardly anyone in ${input.district} is expected to be hired as ${input.occupationLabel} next year`
      : `${cap(peopleCount(demand, o))} in ${input.district} could be hired as ${input.occupationLabel} next year`;
  if (s < 1) return `${first}; no ${singular(prov)} here trains for it yet.`;
  const second = `${prov} here will train ${aboutNum(supply, o)}`;
  if (d >= 1 && supply > 1.25 * demand) return `${first}; ${second}, so many will need to look elsewhere.`;
  return `${first}; ${second}.`;
}

/** Marathi object form: "सुमारे 140 जणांना" / "एका व्यक्तीला". */
export function mrPeopleObj(n: number, o: FormatOptions = {}): string {
  const r = roundPeople(n);
  if (r === 1) return "एका व्यक्तीला";
  const approx = Math.abs(n - r) > 0.05 || Math.abs(n) >= 20;
  return `${approx ? "सुमारे " : ""}${formatIndian(r, { ...o, lang: "mr" })} जणांना`;
}

/** "about 35" (no noun). */
export function aboutNum(n: number, o: FormatOptions = {}): string {
  const r = roundPeople(n);
  const approx = Math.abs(n - r) > 0.05 || Math.abs(n) >= 20;
  return `${approx ? (o.lang === "mr" ? "सुमारे " : "about ") : ""}${formatIndian(r, o)}`;
}

export interface ConfidenceInput {
  coverage: number; // 0..1 from shrink.coverage
  employers?: number; // distinct employers behind the local number, when known
  lang?: Lang;
  digits?: Digits;
}

/** Coverage-driven honesty line: "We're fairly sure." … "This leans on only 6 employers." */
export function confidencePhrase(input: ConfidenceInput): string {
  const c = Number.isFinite(input.coverage) ? input.coverage : 0;
  const mr = input.lang === "mr";
  const o: FormatOptions = { lang: input.lang, digits: input.digits };
  const few = input.employers !== undefined && input.employers < 15;
  if (c >= 0.75 && !few) return mr ? "याबद्दल आम्हाला बऱ्यापैकी खात्री आहे." : "We're fairly sure.";
  if (c >= 0.5 && !few) return mr ? "हा अंदाज बऱ्यापैकी विश्वासार्ह आहे." : "This is a reasonable estimate.";
  if (input.employers !== undefined && input.employers > 0) {
    const k = formatIndian(input.employers, o);
    if (input.employers === 1) return mr ? "हा अंदाज फक्त एका नियोक्त्याच्या माहितीवर आधारित आहे." : "This leans on just 1 employer.";
    return mr ? `हा अंदाज फक्त ${k} नियोक्त्यांच्या माहितीवर आधारित आहे.` : `This leans on only ${k} employers.`;
  }
  if (c >= 0.25) return mr ? "हा ढोबळ अंदाज समजा." : "Treat this as a rough estimate.";
  return mr
    ? "इथली स्थानिक माहिती फारच कमी आहे; हा अंदाज मुख्यतः विभागाच्या आकडेवारीवरून घेतला आहे."
    : "There is very little local data here, so this mostly borrows from the division's numbers.";
}

/** "went up by about 12 people" style change phrase for marginals and deltas. */
export function morePeople(n: number, lang: Lang = "en", digits?: Digits): string {
  const o: FormatOptions = { lang, digits };
  if (lang === "mr") return `${mrPeopleObj(n, o).replace(" जणांना", " अधिक जणांना").replace("एका व्यक्तीला", "आणखी एका व्यक्तीला")}`;
  const r = roundPeople(n);
  return `${aboutNum(n, o)} more ${r === 1 ? "person" : "people"}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const singular = (s: string) => (s.endsWith("s") ? s.slice(0, -1) : s);
export { cap as capitalize };
