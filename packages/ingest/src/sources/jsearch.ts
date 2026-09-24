// JSearch /search-v2 on RapidAPI. Free tier: 200 requests/month, so every call is budgeted:
//   - hard cap per run (--max-requests, default 10) and per month (JSEARCH_MONTHLY_CAP, default 150)
//   - query templates (sector role × hero city) rotate; the cursor in source_health says where to resume
import type { Sql } from "@ks/db";
import { type NormalizeContext, type RawJob, createNormalizeContext, normalizeJob } from "../normalize";
import { type SourceAdapter, healthFromLog, lastCursor, logHealth, requestsThisMonth, storeRaw } from "../store";
import { getJson, sleep } from "../util";
import { logGeoHealth } from "./geo";

export const QUERY_TEMPLATES: Array<{ sector: string; query: string }> = [
  { sector: "electrical", query: "Electrician in Pune, India" },
  { sector: "auto", query: "CNC operator in Pune, India" },
  { sector: "it", query: "Data analyst in Pune, India" },
  { sector: "auto", query: "Welder in Aurangabad, Maharashtra, India" },
  { sector: "electrical", query: "Solar technician in Nashik, India" },
  { sector: "food", query: "Food safety supervisor in Nashik, India" },
  { sector: "auto", query: "Fitter in Nashik, India" },
  { sector: "logistics", query: "Warehouse executive in Bhiwandi, Thane, India" },
  { sector: "health", query: "General duty assistant in Mumbai, India" },
  { sector: "it", query: "Software developer in Mumbai, India" },
  { sector: "logistics", query: "Supply chain executive in Nagpur, India" },
  { sector: "electrical", query: "Electrician in Nagpur, India" },
  { sector: "health", query: "Lab technician in Nashik, India" },
  { sector: "electrical", query: "EV technician in Pune, India" },
  { sector: "it", query: "Technical support in Thane, India" },
  { sector: "auto", query: "Maintenance technician in Aurangabad, Maharashtra, India" },
  { sector: "food", query: "Production supervisor food processing in Pune, India" },
  { sector: "health", query: "Pharmacy assistant in Pune, India" },
  { sector: "logistics", query: "Forklift operator in Pune, India" },
  { sector: "health", query: "Staff nurse in Nagpur, India" },
  { sector: "auto", query: "ITI jobs in Nashik, India" },
  { sector: "all", query: "Jobs in Gadchiroli, Maharashtra, India" },
  { sector: "food", query: "Quality chemist food in Kolhapur, India" },
  { sector: "it", query: "Customer care executive in Pune, India" },
];

interface V2Body { status?: string; data?: RawJob[] | { jobs?: RawJob[]; cursor?: string | null }; message?: string }

export function jobsOf(body: V2Body | null): RawJob[] {
  const d = body?.data;
  if (!d) return [];
  return Array.isArray(d) ? d : d.jobs ?? [];
}

export function createJsearchAdapter(sql: Sql, opts: { maxRequests?: number; start?: number } = {}): SourceAdapter {
  const key = process.env.RAPIDAPI_KEY;
  const monthlyCap = Number(process.env.JSEARCH_MONTHLY_CAP ?? 150);
  return {
    id: "jsearch",
    health: healthFromLog(sql, "jsearch"),
    async fetch() {
      if (!key) {
        await logHealth(sql, { sourceId: "jsearch", ok: false, rows: 0, requests: 0, note: "RAPIDAPI_KEY not set" });
        return { rows: 0, requests: 0, note: "RAPIDAPI_KEY not set" };
      }
      const used = await requestsThisMonth(sql, "jsearch");
      const budget = Math.max(0, Math.min(opts.maxRequests ?? 10, monthlyCap - used));
      const start = opts.start ?? (await lastCursor<{ next: number }>(sql, "jsearch"))?.next ?? 0;
      let ctx: NormalizeContext | null = null;
      let requests = 0, fetched = 0, fresh = 0, dups = 0, latency = 0;
      const errors: string[] = [];
      let i = start;
      for (; requests < budget; i++) {
        const t = QUERY_TEMPLATES[i % QUERY_TEMPLATES.length]!;
        const qs = new URLSearchParams({ query: t.query, country: "in", page: "1", num_pages: "1", date_posted: "month" });
        const r = await getJson<V2Body>(`https://jsearch.p.rapidapi.com/search-v2?${qs}`, {
          headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" }, timeoutMs: 45_000,
        });
        requests++;
        latency += r.ms;
        // Log every spent request immediately, so a crash can never hide quota usage.
        await logHealth(sql, { sourceId: "jsearch", ok: r.status === 200, rows: jobsOf(r.body).length, requests: 1, latencyMs: r.ms,
          note: `request ${t.query} → HTTP ${r.status}` });
        console.log(`[jsearch] ${t.query} → ${r.status}, ${jobsOf(r.body).length} jobs, ${r.ms}ms`);
        if (r.status !== 200) {
          errors.push(`${r.status} on "${t.query}"`);
          if (r.status === 429 || r.status === 403) break; // quota exhausted or key blocked: stop spending
          continue;
        }
        const jobs = jobsOf(r.body);
        ctx ??= await createNormalizeContext(sql);
        for (const job of jobs) {
          if (!job?.job_id) continue;
          fetched++;
          const { id: rawId, isNew } = await storeRaw(sql, "jsearch", job.job_id, { ...job, _query: t.query, _sector: t.sector });
          if (!isNew) continue;
          const res = await normalizeJob(ctx, "jsearch", rawId, job);
          if (res === "new") fresh++;
          if (res === "duplicate") dups++;
        }
        await sleep(1200);
      }
      if (ctx) await logGeoHealth(sql, ctx.geoStats);
      const note = `${requests} requests (month so far ${used + requests}/${monthlyCap}), ${fetched} jobs, ${fresh} new postings, ${dups} duplicates` +
        (errors.length ? `; errors: ${errors.slice(0, 3).join("; ")}` : "") + (budget === 0 ? "; monthly budget exhausted" : "");
      await logHealth(sql, {
        sourceId: "jsearch", ok: requests > 0 && errors.length < requests, rows: fetched, requests: 0, // already counted per request
        latencyMs: Math.round(latency / Math.max(requests, 1)), note, cursor: { next: i % QUERY_TEMPLATES.length },
      });
      return { rows: fetched, requests, note };
    },
  };
}
