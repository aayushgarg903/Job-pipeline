// Stage 2: raw posting → posting + posting_skill. Geocode, title→NCO, skills, dedup.
// Idempotent: re-running over the same raw rows upserts the same posting ids.
import type { Extractor } from "@ks/contracts";
import type { Sql } from "@ks/db";
import { Deduper, descriptionHash } from "./dedup";
import { selectExtractor } from "./extractor";
import type { Geocoder } from "./geocode";
import { type GeoStats, createGeocoder, logGeoHealth } from "./sources/geo";

/** The subset of a JSearch job we rely on (v2 keeps the v1 field names). */
export interface RawJob {
  job_id: string; job_title: string; employer_name?: string | null; job_city?: string | null; job_state?: string | null;
  job_country?: string | null; job_location?: string | null; job_description?: string | null;
  job_posted_at_datetime_utc?: string | null; job_posted_at_timestamp?: number | null; job_apply_link?: string | null;
  job_is_remote?: boolean | null; job_min_salary?: number | null; job_max_salary?: number | null;
  job_required_experience?: { required_experience_in_months?: number | null } | null;
}

export interface NormalizeContext {
  sql: Sql; geocoder: Geocoder; extractor: Extractor; extractorName: string; deduper: Deduper;
  catalog: Array<{ id: string; labelEn: string }>; occupations: Array<{ nco: string; titleEn: string }>; geoStats: GeoStats;
}

export async function createNormalizeContext(sql: Sql): Promise<NormalizeContext> {
  const geoStats: GeoStats = { indiapost: 0, nominatim: 0 };
  const [geocoder, ex, catalog, occs, recent] = await Promise.all([
    createGeocoder(sql, geoStats),
    selectExtractor(sql),
    sql<{ id: string; labelEn: string }[]>`select id, label_en as "labelEn" from ks.skill`,
    sql<{ nco: string; titleEn: string }[]>`select nco_code as nco, title_en as "titleEn" from ks.occupation`,
    sql<Array<{ id: string; employer_name: string; title: string; description: string; posted_at: Date }>>`
      select id, employer_name, title, description, posted_at from ks.posting where not is_duplicate
      and posted_at > now() - interval '60 days' order by posted_at`,
  ]);
  const deduper = new Deduper();
  for (const p of recent) deduper.add({ id: p.id, employer: p.employer_name, title: p.title, description: p.description, postedAt: p.posted_at });
  return { sql, geocoder, extractor: ex.extractor, extractorName: ex.name, deduper, catalog: [...catalog], occupations: [...occs], geoStats };
}

async function upsertEmployer(sql: Sql, name: string, lgd: string | null): Promise<string> {
  const [e] = await sql<{ id: string }[]>`
    select id from ks.employer where lower(name) = lower(${name}) and lgd_code is not distinct from ${lgd} limit 1`;
  if (e) return e.id;
  const [n] = await sql<{ id: string }[]>`insert into ks.employer (name, lgd_code) values (${name}, ${lgd}) returning id`;
  return n!.id;
}

export async function normalizeJob(ctx: NormalizeContext, sourceId: string, rawId: number, job: RawJob): Promise<"new" | "duplicate" | "skipped"> {
  const { sql } = ctx;
  const description = (job.job_description ?? "").trim();
  if (!job.job_id || !job.job_title || description.length < 40) return "skipped";
  const id = `${sourceId}:${job.job_id}`;
  const postedAt = job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc)
    : job.job_posted_at_timestamp ? new Date(job.job_posted_at_timestamp * 1000) : new Date();
  const employerName = (job.employer_name ?? "Unknown employer").trim();

  const geo = await ctx.geocoder.geocode({ city: [job.job_city, job.job_location].filter(Boolean).join(", "), state: job.job_state, text: description });
  const ex = await ctx.extractor.extractPosting({ title: job.job_title, description, skillsCatalog: ctx.catalog, occupations: ctx.occupations });
  const dup = ctx.deduper.add({ id, employer: employerName, title: job.job_title, description, postedAt });
  const employerId = await upsertEmployer(sql, employerName, geo.lgd);
  const expMonths = job.job_required_experience?.required_experience_in_months ?? null;
  const workMode = job.job_is_remote ? "remote" : ex.workMode;

  await sql.begin(async (tx) => {
    await tx`
      insert into ks.posting (id, raw_id, source_id, title, employer_id, employer_name, city, lgd_code, geo_confidence, geo_method,
        nco_code, nco_confidence, work_mode, exp_min, salary_min, salary_max, posted_at, url, description, description_hash,
        canonical_posting_id, is_duplicate, extracted_at)
      values (${id}, ${rawId}, ${sourceId}, ${job.job_title}, ${employerId}, ${employerName}, ${job.job_city ?? job.job_location ?? null},
        ${geo.lgd}, ${geo.confidence}, ${geo.method}, ${ex.nco}, ${ex.ncoConfidence}, ${workMode},
        ${expMonths == null ? null : expMonths / 12}, ${job.job_min_salary ?? null}, ${job.job_max_salary ?? null}, ${postedAt},
        ${job.job_apply_link ?? null}, ${description}, ${descriptionHash(description)}, ${dup.canonicalId}, ${dup.canonicalId != null}, now())
      on conflict (id) do update set lgd_code = excluded.lgd_code, geo_confidence = excluded.geo_confidence, geo_method = excluded.geo_method,
        nco_code = excluded.nco_code, nco_confidence = excluded.nco_confidence, work_mode = excluded.work_mode,
        extracted_at = now(), updated_at = now()`;
    await tx`delete from ks.posting_skill where posting_id = ${id}`;
    const known = ex.skills.filter((s) => s.skillId);
    if (known.length) {
      const rows = known.map((s) => ({
        posting_id: id, skill_id: s.skillId!, raw_text: s.text, requirement: s.requirement, proficiency: s.proficiency,
        years: s.years, evidence_sentence: s.evidence.slice(0, 1000), negated: s.negated, confidence: s.confidence, model_id: ex.model,
      }));
      await tx`insert into ks.posting_skill ${tx(rows, "posting_id", "skill_id", "raw_text", "requirement", "proficiency", "years",
        "evidence_sentence", "negated", "confidence", "model_id")} on conflict do nothing`;
    }
    for (const s of ex.skills.filter((x) => !x.skillId)) {
      await tx`insert into ks.review_item (kind, ref_id, payload) values ('unknown-skill', ${id}, ${tx.json({ text: s.text, evidence: s.evidence })})`;
    }
    if (!ex.nco || ex.ncoConfidence < 0.75) {
      await tx`insert into ks.review_item (kind, ref_id, payload)
               select 'low-confidence', ${id}, ${tx.json({ field: "nco", title: job.job_title, guess: ex.nco, confidence: ex.ncoConfidence })}
               where not exists (select 1 from ks.review_item where ref_id = ${id} and kind = 'low-confidence')`;
    }
    if (dup.canonicalId && dup.reason === "jaccard") {
      await tx`insert into ks.review_item (kind, ref_id, payload)
               select 'duplicate', ${id}, ${tx.json({ canonical: dup.canonicalId, similarity: dup.similarity })}
               where not exists (select 1 from ks.review_item where ref_id = ${id} and kind = 'duplicate')`;
    }
  });
  return dup.canonicalId ? "duplicate" : "new";
}

/** Re-run normalisation over every stored JSearch raw record (no API calls). */
export async function normalizeStoredPostings(sql: Sql): Promise<Record<string, number>> {
  const ctx = await createNormalizeContext(sql);
  const raws = await sql<{ id: number; source_id: string; payload: RawJob }[]>`
    select id, source_id, payload from ks.raw_record where source_id = 'jsearch' order by id`;
  const out: Record<string, number> = { new: 0, duplicate: 0, skipped: 0 };
  for (const r of raws) out[await normalizeJob(ctx, r.source_id, r.id, r.payload)]!++;
  await logGeoHealth(sql, ctx.geoStats);
  return { ...out, total: raws.length };
}
