// Shared DB plumbing for adapters: source catalogue, raw_record, source_health.
import type { Sql } from "@ks/db";
import { sha256 } from "./util";

export interface SourceDef {
  id: string; kind: string; name: string; licence: string; url: string; freshnessSlaHours: number;
  weightDefault: number | null; notes: string;
}

/** Fusion weights (sum to 1 over demand signals) are published here and on /sources. */
export const SOURCES: SourceDef[] = [
  { id: "udyam", kind: "udyam", name: "Udyam MSME registrations (data.gov.in 8b68ae56)", licence: "GODL-India",
    url: "https://data.gov.in/resource/8b68ae56-84cf-4728-a0a6-1be11028dea7", freshnessSlaHours: 24 * 8, weightDefault: 0.4,
    notes: "District totals exact (API total); NIC and quarter mix from random-offset samples, shrunk to state mix" },
  { id: "jsearch", kind: "postings", name: "JSearch /search-v2 (RapidAPI)", licence: "RapidAPI ToS (aggregated Google for Jobs)",
    url: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch", freshnessSlaHours: 24 * 7, weightDefault: 0.25,
    notes: "Free tier 200 req/month; query templates rotate over sectors × hero cities" },
  { id: "survey", kind: "surveys", name: "Employer survey (in-app)", licence: "first-party", url: "/employer/survey",
    freshnessSlaHours: 24 * 90, weightDefault: 0.3, notes: "Demo responses carry is_demo=true" },
  { id: "consultation", kind: "consultations", name: "Industry consultation minutes", licence: "first-party", url: "/consultations",
    freshnessSlaHours: 24 * 180, weightDefault: 0.05, notes: "None recorded yet" },
  { id: "esco", kind: "taxonomy", name: "ESCO API (European Commission)", licence: "CC BY 4.0 / EU reuse",
    url: "https://ec.europa.eu/esco/api", freshnessSlaHours: 24 * 90, weightDefault: null, notes: "Skill URIs" },
  { id: "indiapost", kind: "geocoding", name: "India Post pincode API", licence: "public API",
    url: "https://api.postalpincode.in", freshnessSlaHours: 24 * 365, weightDefault: null, notes: "Pincode → district" },
  { id: "nominatim", kind: "geocoding", name: "OpenStreetMap Nominatim", licence: "ODbL",
    url: "https://nominatim.openstreetmap.org", freshnessSlaHours: 24 * 365, weightDefault: null, notes: "1 req/s, last resort" },
  { id: "openalex", kind: "trend", name: "OpenAlex works per year", licence: "CC0", url: "https://api.openalex.org",
    freshnessSlaHours: 24 * 30, weightDefault: null, notes: "Global series for the curated Radar" },
  { id: "supply-estimate", kind: "supply", name: "State PMKVY / ITI supply, apportioned by Udyam weights",
    licence: "derived (estimated)", url: "https://data.gov.in", freshnessSlaHours: 24 * 365, weightDefault: null,
    notes: "ESTIMATED: state totals split by district Udyam share until DSEEI shares district data" },
  { id: "demo-institutes", kind: "supply", name: "Demo institutes, courses, cohorts (SPECIMEN)", licence: "synthetic",
    url: "", freshnessSlaHours: 24 * 365, weightDefault: null, notes: "is_demo=true; replaced by institute uploads" },
];

export async function ensureSources(sql: Sql): Promise<void> {
  for (const s of SOURCES) {
    await sql`
      insert into ks.source (id, kind, name, licence, url, freshness_sla_hours, weight_default, notes)
      values (${s.id}, ${s.kind}, ${s.name}, ${s.licence}, ${s.url}, ${s.freshnessSlaHours}, ${s.weightDefault}, ${s.notes})
      on conflict (id) do update set kind = excluded.kind, name = excluded.name, licence = excluded.licence, url = excluded.url,
        freshness_sla_hours = excluded.freshness_sla_hours, weight_default = excluded.weight_default, notes = excluded.notes`;
  }
}

/** Bulk insert in chunks: `insert into ks.<table> (cols) values ...`. */
export async function insertMany(sql: Sql, table: string, rows: object[], cols: string[], chunkSize = 4000): Promise<void> {
  // postgres.js' dynamic-column helper can't be typed with a runtime column list.
  const s = sql as unknown as (strings: TemplateStringsArray | object[] | string, ...rest: unknown[]) => Promise<unknown>;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await s`insert into ${s(`ks.${table}`)} ${s(rows.slice(i, i + chunkSize), ...cols)}`;
  }
}

/** Immutable insert. Returns the row id and whether it was new. */
export async function storeRaw(sql: Sql, sourceId: string, externalId: string, payload: unknown): Promise<{ id: number; isNew: boolean }> {
  const hash = sha256(JSON.stringify(payload));
  const [ins] = await sql<{ id: number }[]>`
    insert into ks.raw_record (source_id, external_id, payload, content_hash)
    values (${sourceId}, ${externalId}, ${sql.json(payload as never)}, ${hash})
    on conflict (source_id, external_id) do nothing returning id`;
  if (ins) return { id: ins.id, isNew: true };
  const [ex] = await sql<{ id: number }[]>`select id from ks.raw_record where source_id = ${sourceId} and external_id = ${externalId}`;
  return { id: ex!.id, isNew: false };
}

export interface HealthEntry { sourceId: string; ok: boolean; rows: number; requests: number; latencyMs?: number; note?: string; cursor?: unknown }

export async function logHealth(sql: Sql, h: HealthEntry): Promise<void> {
  await sql`
    insert into ks.source_health (source_id, ok, rows, requests, latency_ms, note, cursor)
    values (${h.sourceId}, ${h.ok}, ${h.rows}, ${h.requests}, ${h.latencyMs ?? null}, ${h.note ?? null},
            ${h.cursor == null ? null : sql.json(h.cursor as never)})`;
}

export async function lastCursor<T>(sql: Sql, sourceId: string): Promise<T | null> {
  const [r] = await sql<{ cursor: T }[]>`
    select cursor from ks.source_health where source_id = ${sourceId} and cursor is not null order by run_at desc limit 1`;
  return r?.cursor ?? null;
}

export async function requestsThisMonth(sql: Sql, sourceId: string): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select coalesce(sum(requests), 0)::int as n from ks.source_health
    where source_id = ${sourceId} and run_at >= date_trunc('month', now())`;
  return r?.n ?? 0;
}

/** The adapter contract from Architecture §4: fetch(since) then health(). */
export interface SourceAdapter {
  id: string;
  fetch(since: Date | null): Promise<{ rows: number; requests: number; note: string }>;
  health(): Promise<{ ok: boolean; lastRunAt: string | null; note: string }>;
}

export function healthFromLog(sql: Sql, sourceId: string): SourceAdapter["health"] {
  return async () => {
    const [r] = await sql<Array<{ ok: boolean; run_at: Date; note: string | null }>>`
      select ok, run_at, note from ks.source_health where source_id = ${sourceId} order by run_at desc limit 1`;
    return { ok: Boolean(r?.ok), lastRunAt: r ? r.run_at.toISOString() : null, note: r?.note ?? "never run" };
  };
}
