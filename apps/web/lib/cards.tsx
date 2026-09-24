// Contract types -> Card props, with humane copy from messages. Shared by the landing page,
// the gallery, the compare resolver and (next) the product pages.
import type { Course, CourseHealth, DemandCell, DistrictSummary, Lang, Skill } from "@ks/contracts";
import { formatNumber, formatPercent, humanRound, VERDICTS, type CardProps, type CompareItem } from "@ks/ui";
import type { ReactNode } from "react";
import { routes } from "./routes";

/** Minimal translator shape (next-intl's getTranslations() result satisfies it). */
export interface Tr {
  (key: string, values?: Record<string, string | number>): string;
  rich(key: string, values: Record<string, string | number | ((chunks: ReactNode) => ReactNode)>): ReactNode;
  raw(key: string): unknown;
}

const bold = (c: ReactNode) => <strong>{c}</strong>;

/** "Chh. Sambhajinagar" -> "sambhajinagar" (messages: divisions.*). */
export function divisionKey(division: string): string {
  const k = division.toLowerCase();
  return k.includes("sambhaji") || k.includes("aurangabad") ? "sambhajinagar" : k.replace(/[^a-z]/g, "");
}
const people = (n: number, lang: Lang) => formatNumber(humanRound(Math.abs(n)), lang);

export function districtCard(s: DistrictSummary, t: Tr, lang: Lang, topCell?: DemandCell, skillLabel?: (id: string) => string): CardProps {
  const d = s.district;
  const name = lang === "mr" ? d.nameMr : d.nameEn;
  const short = s.topShortage ? { ...s.topShortage, label: skillLabel?.(s.topShortage.skillId) ?? s.topShortage.label } : null;
  const verdictWord = short ? "SHORTAGE" : "BALANCED";
  const v = VERDICTS[verdictWord];
  const human = short
    ? t.rich(topCell ? "districtCard.human" : "districtCard.humanGapOnly", {
        gap: people(short.gap, lang), demand: people(topCell?.demand ?? short.gap, lang), supply: formatNumber(topCell?.supply ?? 0, lang), district: name, skill: short.label, b: bold,
      })
    : t("districtCard.humanNone", { district: name });
  return {
    variant: "district",
    code: `LGD ${d.lgd}`,
    name,
    title: t("districtCard.title", { division: t(`divisions.${divisionKey(d.division)}`) }),
    figure: {
      label: t("districtCard.figure"),
      value: formatNumber(s.mismatch, lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      evidenceTitle: t("districtCard.evidenceTitle", { district: name }),
      evidenceIntro: s.coverage < 0.4 ? t("districtCard.lowSignal", { postings: formatNumber(s.postings, lang) }) : t("districtCard.evidenceIntro", { district: name }),
    },
    verdict: { tone: v.tone, glyph: v.glyph, word: t(`verdict.${verdictWord}`), text: short?.label },
    human,
    provenance: s.provenance,
    href: routes.district(d.lgd),
    compare: {
      ref: `district:${d.lgd}`,
      fields: [
        { key: "mismatch", label: t("fields.mismatch"), value: s.mismatch, display: formatNumber(s.mismatch, lang, { maximumFractionDigits: 2 }) },
        { key: "shortage", label: t("fields.shortage"), value: short?.label ?? "—" },
        { key: "gap", label: t("fields.gap"), value: short?.gap ?? 0, display: short ? people(short.gap, lang) : "—" },
        { key: "coverage", label: t("fields.coverage"), value: s.coverage, display: formatPercent(s.coverage, lang) },
      ],
    },
    lang,
  };
}

export function courseCard(c: Course & { health: CourseHealth | null }, districtName: string, t: Tr, lang: Lang, skillLabel: (id: string) => string, asOf: string): CardProps {
  const h = c.health;
  const flag = h?.flags[0] ?? "HEALTHY";
  const v = VERDICTS[flag];
  const placed = h?.placementRate != null ? Math.round(h.placementRate * 100) : null;
  return {
    variant: "course",
    code: c.code,
    name: c.name,
    title: t("courseCard.title", { institution: c.institutionName, seats: formatNumber(c.seats, lang) }),
    figure: h
      ? {
          label: t("courseCard.figure"),
          value: String(h.total),
          evidenceTitle: t("courseCard.evidenceTitle", { score: h.total }),
          evidenceIntro: t("courseCard.evidenceIntro", { course: c.name }),
        }
      : undefined,
    verdict: { tone: v.tone, glyph: v.glyph, word: t(`verdict.${flag}`), text: h?.flags.length && h.flags.length > 1 ? h.flags.slice(1).map((f) => t(`verdict.${f}`)).join(" · ") : undefined },
    human: placed !== null ? t.rich("courseCard.human", { placed, b: bold }) : undefined,
    provenance: {
      sources: [
        { kind: "placement", label: t("prov.traced"), n: Math.round(c.seats * 0.8) },
        { kind: "postings", label: t("prov.matchingPosts"), n: 40 + c.seats },
      ],
      asOf,
      isDemo: c.isDemo,
      lapsed: false,
    },
    href: routes.course(c.id),
    compare: {
      ref: `course:${c.id}`,
      fields: [
        { key: "health", label: t("fields.health"), value: h?.total ?? null, display: h ? `${h.total}/100` : "—" },
        { key: "flags", label: t("fields.flags"), value: h?.flags.map((f) => t(`verdict.${f}`)).join(", ") ?? "—" },
        { key: "placement", label: t("fields.placement"), value: h?.placementRate ?? null, display: h?.placementRate != null ? formatPercent(h.placementRate, lang) : "—" },
        { key: "seats", label: t("fields.seats"), value: c.seats, display: formatNumber(c.seats, lang) },
        { key: "hours", label: t("fields.hours"), value: c.durationHours, display: formatNumber(c.durationHours, lang) },
        { key: "district", label: t("fields.district"), value: districtName },
        { key: "missing", label: t("fields.missing"), value: h?.missingSkills.map(skillLabel).join(", ") || "—" },
      ],
    },
    lang,
  };
}

export function skillCard(skill: Skill, cell: DemandCell, districtName: string, delta: number, t: Tr, lang: Lang, asOf: string): CardProps {
  const word = cell.gap > 0 && cell.ratio >= 1.3 ? "SHORTAGE" : cell.ratio < 0.8 ? "OVERSUPPLY" : "BALANCED";
  const v = VERDICTS[word];
  const label = lang === "mr" && skill.labelMr ? skill.labelMr : skill.labelEn;
  return {
    variant: "skill",
    code: skill.id.toUpperCase().replace(/-/g, "·").slice(0, 22),
    name: label,
    title: t("skillCard.title", { district: districtName }),
    figure: {
      label: t("skillCard.figure"),
      value: String(cell.sdi),
      delta: { text: String(Math.abs(delta)), dir: delta > 0 ? "up" : delta < 0 ? "down" : "flat" },
      evidenceTitle: t("skillCard.evidenceTitle", { skill: label, district: districtName }),
    },
    verdict: {
      tone: v.tone, glyph: v.glyph, word: t(`verdict.${word}`),
      text: t("skillCard.verdictText", { demand: formatNumber(cell.demand, lang), supply: formatNumber(cell.supply, lang), ratio: formatNumber(cell.ratio, lang, { maximumFractionDigits: 1 }) }),
    },
    human: t.rich("skillCard.human", { demand: people(cell.demand, lang), supply: formatNumber(cell.supply, lang), district: districtName, b: bold }),
    provenance: {
      sources: [
        { kind: "postings", label: t("prov.postings"), n: Math.round(cell.demand * 0.33) },
        { kind: "surveys", label: t("prov.surveys"), n: Math.max(3, Math.round(cell.demand / 60)) },
      ],
      asOf,
      isDemo: true,
      lapsed: false,
    },
    href: routes.skill(skill.id),
    compare: {
      ref: `skill:${skill.id}`,
      fields: [
        { key: "demand", label: t("fields.demand"), value: cell.demand, display: formatNumber(humanRound(cell.demand), lang) },
        { key: "supply", label: t("fields.supply"), value: cell.supply, display: formatNumber(humanRound(cell.supply), lang) },
        { key: "gap", label: t("fields.gap"), value: cell.gap, display: formatNumber(humanRound(cell.gap), lang) },
        { key: "coverage", label: t("fields.coverage"), value: cell.coverage, display: formatPercent(cell.coverage, lang) },
      ],
    },
    lang,
  };
}

/** Card -> tray item (for the compare resolver). */
export function toCompareItem(p: CardProps): CompareItem | null {
  if (!p.compare) return null;
  return { ref: p.compare.ref, name: p.compare.name ?? p.name, code: p.code, variant: p.variant, href: p.href, fields: p.compare.fields };
}
