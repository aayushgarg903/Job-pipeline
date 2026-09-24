// Udyam MSME registrations (data.gov.in resource 8b68ae56-84cf-4728-a0a6-1be11028dea7).
// The feed has 6.8M Maharashtra rows, and the public sample key returns ≤10 rows per call under a
// tight rate limit, so full aggregation is impossible. Strategy:
//   A. exact district totals: filters[LG_DT_Code]=<lgd>&limit=1 → read `total` (36 calls)
//   B. random-offset samples across the state (10 rows each) → NIC-5 and quarter mix per district
//   C. udyam_fact = total(d) × P(quarter | d) × P(nic | d), both shrunk toward the state mix
//      (method = 'apportioned'). With a personal DATA_GOV_IN_KEY, samples are 1000 rows per call.
import type { Sql } from "@ks/db";
import { type SourceAdapter, healthFromLog, logHealth, storeRaw } from "../store";
import { getJson, sha256, sleep } from "../util";

const RESOURCE = "8b68ae56-84cf-4728-a0a6-1be11028dea7";
const SAMPLE_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";

interface UdyamRecord {
  LG_DT_Code: number | string; District: string; Pincode: string; RegistrationDate: string;
  EnterpriseName: string; Activities: string;
}
interface UdyamResponse { total?: number; records?: UdyamRecord[]; error?: string }

export interface UdyamOptions { samples?: number; budgetMs?: number; skipTotals?: boolean }

export function createUdyamAdapter(sql: Sql, opts: UdyamOptions = {}): SourceAdapter {
  const key = process.env.DATA_GOV_IN_KEY || SAMPLE_KEY;
  const personal = key !== SAMPLE_KEY;
  const pageSize = personal ? 1000 : 10;
  const deadline = Date.now() + (opts.budgetMs ?? 20 * 60_000);
  let requests = 0;
  let latency = 0;

  async function call(params: Record<string, string | number>): Promise<UdyamResponse | null> {
    const qs = new URLSearchParams({ "api-key": key, format: "json", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    for (let attempt = 0; Date.now() < deadline; attempt++) {
      const r = await getJson<UdyamResponse>(`https://api.data.gov.in/resource/${RESOURCE}?${qs}`, { timeoutMs: 45_000 });
      requests++;
      latency += r.ms;
      if (r.status === 200 && r.body && !r.body.error) return r.body;
      // 429 "Rate limit exceeded" (or a 5xx): back off, capped at 90s.
      await sleep(Math.min(90_000, 15_000 * (attempt + 1)));
    }
    return null;
  }

  return {
    id: "udyam",
    health: healthFromLog(sql, "udyam"),
    async fetch() {
      const districts = await sql<{ lgd_code: string; name_en: string }[]>`select lgd_code, name_en from ks.geo_district order by lgd_code`;
      let totals = 0;
      let rows = 0;
      const notes: string[] = [];

      if (!opts.skipTotals) {
        for (const d of districts) {
          const body = await call({ limit: 1, "filters[LG_DT_Code]": d.lgd_code });
          if (!body || typeof body.total !== "number") { notes.push(`total ${d.lgd_code} failed`); continue; }
          const today = new Date().toISOString().slice(0, 10);
          await storeRaw(sql, "udyam", `total:${d.lgd_code}:${today}`, { lgd: d.lgd_code, total: body.total, asOf: today });
          await sql`insert into ks.udyam_district_total (lgd_code, district_name, total, fetched_at)
                    values (${d.lgd_code}, ${d.name_en}, ${body.total}, now())
                    on conflict (lgd_code) do update set total = excluded.total, fetched_at = now()`;
          totals++;
          await sleep(1500);
        }
      }

      const [state] = await sql<{ t: number | null }[]>`select sum(total)::float8 as t from ks.udyam_district_total`;
      const stateTotal = Math.max(1, Math.floor(state?.t ?? 6_800_000));
      const nSamples = opts.samples ?? 60;
      for (let i = 0; i < nSamples && Date.now() < deadline; i++) {
        const offset = Math.floor(Math.random() * Math.max(1, stateTotal - pageSize));
        const body = await call({ limit: pageSize, offset, "filters[State]": "MAHARASHTRA" });
        if (!body?.records) { notes.push(`sample ${i} failed`); continue; }
        for (const rec of body.records) {
          const ext = sha256(`${rec.EnterpriseName}|${rec.RegistrationDate}|${rec.Pincode}|${rec.LG_DT_Code}`).slice(0, 32);
          const { isNew } = await storeRaw(sql, "udyam", `row:${ext}`, rec);
          if (isNew) rows++;
        }
        await sleep(1500);
      }

      const built = await buildUdyamFacts(sql);
      const note = `${totals}/${districts.length} district totals, ${rows} new sampled rows, ${built} fact rows` +
        (personal ? "" : " (public sample key)") + (notes.length ? `; ${notes.slice(0, 5).join(", ")}` : "");
      await logHealth(sql, { sourceId: "udyam", ok: totals > 0 || rows > 0, rows: totals + rows, requests, latencyMs: Math.round(latency / Math.max(requests, 1)), note });
      return { rows: totals + rows, requests, note };
    },
  };
}

/** dd/mm/yyyy → quarter-start ISO date (udyam_fact.month holds the quarter start). */
export function quarterStartOf(ddmmyyyy: string): string | null {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[2]);
  const qm = Math.floor((month - 1) / 3) * 3 + 1;
  return `${m[3]}-${String(qm).padStart(2, "0")}-01`;
}

export function nicsOf(activities: string): string[] {
  try {
    const xs = JSON.parse(activities) as Array<{ NIC5DigitId?: string }>;
    return xs.map((x) => String(x.NIC5DigitId ?? "")).filter((s) => /^\d{5}$/.test(s));
  } catch {
    return [];
  }
}

/** Map any NIC-5 to the crosswalk's NIC-5 at the longest shared prefix (5, 4, 3, then 2 digits). */
export function mapNic(nic: string, xwalkNics: string[]): string {
  for (const len of [5, 4, 3, 2]) {
    const hit = xwalkNics.find((x) => x.slice(0, len) === nic.slice(0, len));
    if (hit) return hit;
  }
  return "other";
}

/** Rebuild udyam_fact from district totals and all sampled rows (idempotent). */
export async function buildUdyamFacts(sql: Sql, alpha = 20): Promise<number> {
  const totals = await sql<{ lgd_code: string; total: number }[]>`select lgd_code, total from ks.udyam_district_total`;
  if (totals.length === 0) return 0;
  const xw = (await sql<{ nic5: string }[]>`select distinct nic5 from ks.nic_nco_xwalk`).map((r) => r.nic5).sort();
  const samples = await sql<{ payload: UdyamRecord }[]>`select payload from ks.raw_record where source_id = 'udyam' and external_id like 'row:%'`;

  const minQ = "2023-07-01"; // keep ~3 years of quarters
  const cnt = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
  const stateQ = new Map<string, number>(); const stateN = new Map<string, number>();
  const dQ = new Map<string, Map<string, number>>(); const dN = new Map<string, Map<string, number>>();
  const dCount = new Map<string, number>();
  let allQ = 0;
  for (const { payload: r } of samples) {
    const lgd = String(r.LG_DT_Code);
    const q = quarterStartOf(r.RegistrationDate);
    const nics = nicsOf(r.Activities);
    if (!q) continue;
    allQ++;
    cnt(stateQ, q); if (!dQ.has(lgd)) dQ.set(lgd, new Map()); cnt(dQ.get(lgd)!, q);
    cnt(dCount, lgd);
    for (const n of nics.length ? nics : ["other"]) {
      const mapped = n === "other" ? "other" : mapNic(n, xw);
      const w = 1 / Math.max(nics.length, 1);
      cnt(stateN, mapped, w); if (!dN.has(lgd)) dN.set(lgd, new Map()); cnt(dN.get(lgd)!, mapped, w);
    }
  }
  if (allQ === 0) return 0;
  const shrink = (local: Map<string, number> | undefined, state: Map<string, number>, stateSum: number, n: number) => {
    const out = new Map<string, number>();
    for (const [k, v] of state) out.set(k, ((local?.get(k) ?? 0) + (alpha * v) / stateSum) / (n + alpha));
    return out;
  };
  const stateNSum = [...stateN.values()].reduce((a, b) => a + b, 0);
  const rows: Array<{ month: string; lgd_code: string; nic5: string; registrations: number; method: string }> = [];
  for (const t of totals) {
    const n = dCount.get(t.lgd_code) ?? 0;
    const pq = shrink(dQ.get(t.lgd_code), stateQ, allQ, n);
    const pn = shrink(dN.get(t.lgd_code), stateN, stateNSum, n);
    for (const [q, qp] of pq) {
      if (q < minQ) continue;
      for (const [nic, np] of pn) {
        // nic5 = 'other' keeps non-focus registrations so district totals stay whole.
        const reg = t.total * qp * np;
        if (reg >= 0.5) rows.push({ month: q, lgd_code: t.lgd_code, nic5: nic, registrations: Math.round(reg * 10) / 10, method: "apportioned" });
      }
    }
  }
  await sql.begin(async (tx) => {
    await tx`delete from ks.udyam_fact where method = 'apportioned'`;
    for (let i = 0; i < rows.length; i += 2000) {
      await tx`insert into ks.udyam_fact ${tx(rows.slice(i, i + 2000), "month", "lgd_code", "nic5", "registrations", "method")}`;
    }
  });
  return rows.length;
}
