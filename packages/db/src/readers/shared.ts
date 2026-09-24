import type { District, Proficiency, Provenance, Skill } from "@ks/contracts";
import type { Sql } from "../client";

export const num = (v: unknown): number => (v == null ? 0 : Number(v));
export const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
export const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
export const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));
export const prof = (v: unknown): Proficiency => Math.min(4, Math.max(1, Number(v) || 1)) as Proficiency;

export async function latestQuarter(sql: Sql): Promise<string | null> {
  const [r] = await sql<{ q: string | null }[]>`select max(quarter) as q from ks.demand_cell`;
  return r?.q ?? null;
}

export function prevQuarter(q: string): string {
  const [y, n] = q.split("-Q").map(Number) as [number, number];
  return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`;
}

export interface DistrictRow {
  lgd_code: string; name_en: string; name_mr: string; division: string;
  population: number | null; is_aspirational: boolean;
}
export const toDistrict = (r: DistrictRow): District => ({
  lgd: r.lgd_code, nameEn: r.name_en, nameMr: r.name_mr, division: r.division,
  population: numOrNull(r.population), isAspirational: r.is_aspirational,
});

export interface SkillRow { id: string; label_en: string; label_mr: string | null; kind: string; esco_uri: string | null }
export const toSkill = (r: SkillRow): Skill => ({
  id: r.id, labelEn: r.label_en, labelMr: r.label_mr, kind: r.kind as Skill["kind"], escoUri: r.esco_uri,
});

/** Sources whose latest successful fetch is older than their SLA → LAPSED. */
export async function lapsedSources(sql: Sql): Promise<Set<string>> {
  const rows = await sql<{ id: string }[]>`
    select s.id from ks.source s
    left join lateral (select max(run_at) as last from ks.source_health h where h.source_id = s.id and h.ok) h on true
    where s.kind in ('postings','udyam') and (h.last is null or h.last < now() - make_interval(hours => s.freshness_sla_hours))`;
  return new Set(rows.map((r) => r.id));
}

export function provenance(
  sources: Provenance["sources"], asOf: unknown, isDemo: boolean, lapsed: boolean,
): Provenance {
  return { sources, asOf: asOf ? iso(asOf) : new Date().toISOString(), isDemo, lapsed };
}
