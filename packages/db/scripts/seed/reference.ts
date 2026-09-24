// Reference data loader: geography + taxonomy from packages/db/data/*.json. Idempotent upserts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "../../src/client";

export const DATA_DIR = join(import.meta.dirname, "..", "..", "data");
export function readData<T>(file: string): T | null {
  const p = join(DATA_DIR, file);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
}

interface DistrictJson { lgd: string; nameEn: string; nameMr: string; division: string; population: number | null; isAspirational: boolean; census2011: string | null; lgdName?: string; aliases?: string[] }
interface GeoJson { features: Array<{ properties: { lgd: string; derived?: string }; geometry: unknown }> }
export interface SkillJson { id: string; labelEn: string; labelMr: string | null; kind: string; escoUri: string | null; sector?: string; aliases?: string[] }
export interface OccupationJson { nco: string; titleEn: string; titleMr: string | null; nsqfLevel: number | null; sector: string }
export interface OccSkillJson { nco: string; skillId: string; weight: number; proficiency: number; essential: boolean }
export interface XwalkJson { nic5: string; nicTitle: string; nco: string; share: number; employmentPerUnit: number; sector: string }
export interface TradeJson {
  code: string; name: string; kind: string; sector: string; nco: string; durationHours: number; nsqfLevel: number | null;
  trainerQualification: string; equipment: string[]; skills: Array<{ skillId: string; proficiency: number; hours: number; module: string }>;
}

const batches = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function seedReference(sql: Sql): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const districts = readData<DistrictJson[]>("districts.json") ?? [];
  const geo = readData<GeoJson>("mh-districts.geo.json");
  const geomBy = new Map(geo?.features.map((f) => [f.properties.lgd, f]) ?? []);
  for (const d of districts) {
    const f = geomBy.get(d.lgd);
    const note = f?.properties.derived ? `Palghar/Thane split: ${f.properties.derived}` : null;
    await sql`insert into ks.geo_district (lgd_code, name_en, name_mr, division, population, is_aspirational, census2011, geom, geom_note)
      values (${d.lgd}, ${d.nameEn}, ${d.nameMr}, ${d.division}, ${d.population}, ${d.isAspirational}, ${d.census2011},
              ${f ? sql.json(f.geometry as never) : null}, ${note})
      on conflict (lgd_code) do update set name_en = excluded.name_en, name_mr = excluded.name_mr, division = excluded.division,
        population = excluded.population, is_aspirational = excluded.is_aspirational, census2011 = excluded.census2011,
        geom = excluded.geom, geom_note = excluded.geom_note`;
  }
  counts.geo_district = districts.length;

  const aliases = readData<Array<{ alias: string; lgd: string; source: string }>>("geo_alias.json") ?? [];
  for (const b of batches(aliases.map((a) => ({ alias: a.alias.toLowerCase(), lgd_code: a.lgd, source: a.source })))) {
    await sql`insert into ks.geo_alias ${sql(b, "alias", "lgd_code", "source")} on conflict do nothing`;
  }
  counts.geo_alias = aliases.length;

  const occs = readData<OccupationJson[]>("occupations.json") ?? [];
  for (const o of occs) {
    await sql`insert into ks.occupation (nco_code, title_en, title_mr, nsqf_level, sector)
      values (${o.nco}, ${o.titleEn}, ${o.titleMr}, ${o.nsqfLevel}, ${o.sector})
      on conflict (nco_code) do update set title_en = excluded.title_en, title_mr = excluded.title_mr,
        nsqf_level = excluded.nsqf_level, sector = excluded.sector`;
  }
  counts.occupation = occs.length;

  const skills = readData<SkillJson[]>("skills.json") ?? [];
  for (const b of batches(skills)) {
    const rows = b.map((s) => ({ id: s.id, esco_uri: s.escoUri, label_en: s.labelEn, label_mr: s.labelMr, kind: s.kind, sector: s.sector ?? null }));
    await sql`insert into ks.skill ${sql(rows, "id", "esco_uri", "label_en", "label_mr", "kind", "sector")}
      on conflict (id) do update set esco_uri = coalesce(excluded.esco_uri, ks.skill.esco_uri), label_en = excluded.label_en,
        label_mr = excluded.label_mr, kind = excluded.kind, sector = excluded.sector`;
  }
  counts.skill = skills.length;
  const sAliases = skills.flatMap((s) => [
    ...(s.aliases ?? []).map((a) => ({ alias: a.toLowerCase(), skill_id: s.id, lang: /[ऀ-ॿ]/.test(a) ? "mr" : "en" })),
    ...(s.labelMr ? [{ alias: s.labelMr, skill_id: s.id, lang: "mr" }] : []),
  ]);
  for (const b of batches(sAliases)) await sql`insert into ks.skill_alias ${sql(b, "alias", "skill_id", "lang")} on conflict do nothing`;
  counts.skill_alias = sAliases.length;

  const prof = readData<OccSkillJson[]>("occupation_skills.json") ?? [];
  for (const b of batches(prof.map((p) => ({ nco_code: p.nco, skill_id: p.skillId, weight: p.weight, proficiency: p.proficiency, essential: p.essential })))) {
    await sql`insert into ks.occupation_skill ${sql(b, "nco_code", "skill_id", "weight", "proficiency", "essential")}
      on conflict (nco_code, skill_id) do update set weight = excluded.weight, proficiency = excluded.proficiency, essential = excluded.essential`;
  }
  counts.occupation_skill = prof.length;

  const xw = readData<XwalkJson[]>("nic_nco_xwalk.json") ?? [];
  for (const b of batches(xw.map((x) => ({ nic5: x.nic5, nco_code: x.nco, share: x.share, employment_per_unit: x.employmentPerUnit, nic_title: x.nicTitle, sector: x.sector, reviewed_by: "draft (unreviewed)" })))) {
    await sql`insert into ks.nic_nco_xwalk ${sql(b, "nic5", "nco_code", "share", "employment_per_unit", "nic_title", "sector", "reviewed_by")}
      on conflict (nic5, nco_code) do update set share = excluded.share, employment_per_unit = excluded.employment_per_unit,
        nic_title = excluded.nic_title, sector = excluded.sector`;
  }
  counts.nic_nco_xwalk = xw.length;

  // Trades double as qualifications (NCVT trade code / NSQF QP code) with their skill hours.
  const trades = readData<TradeJson[]>("trades.json") ?? [];
  for (const t of trades) {
    await sql`insert into ks.qualification (qp_code, title, nsqf_level, sector_ssc, hours, nco_code, trainer_qualification, equipment)
      values (${t.code}, ${t.name}, ${t.nsqfLevel}, ${t.sector}, ${t.durationHours}, ${t.nco}, ${t.trainerQualification}, ${sql.json(t.equipment)})
      on conflict (qp_code) do update set title = excluded.title, nsqf_level = excluded.nsqf_level, hours = excluded.hours,
        nco_code = excluded.nco_code, trainer_qualification = excluded.trainer_qualification, equipment = excluded.equipment`;
    await sql`delete from ks.qp_skill where qp_code = ${t.code}`;
    for (const s of t.skills) {
      await sql`insert into ks.qp_skill (qp_code, skill_id, proficiency, hours, module)
        values (${t.code}, ${s.skillId}, ${s.proficiency}, ${s.hours}, ${s.module}) on conflict do nothing`;
    }
  }
  counts.qualification = trades.length;
  return counts;
}
