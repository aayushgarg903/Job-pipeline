// India Post pincode API + Nominatim, both cached in the DB, wired into the Geocoder chain.
import type { Sql } from "@ks/db";
import { readRefData } from "@ks/db/refdata";
import { Geocoder } from "../geocode";
import { logHealth } from "../store";
import { getJson, sleep } from "../util";

const UA = "KaushalSetu/0.1 (SIH 2026 PS 26134 labour-market research; https://github.com/Sahildhillon0)";

export interface GeoStats { indiapost: number; nominatim: number }

export async function createGeocoder(sql: Sql, stats: GeoStats = { indiapost: 0, nominatim: 0 }): Promise<Geocoder> {
  const districts = await sql<Array<{ lgd_code: string; name_en: string; name_mr: string }>>`
    select lgd_code, name_en, name_mr from ks.geo_district`;
  const aliases = await sql<Array<{ alias: string; lgd_code: string; source: string }>>`select alias, lgd_code, source from ks.geo_alias`;
  const prefixes = readRefData<Array<{ prefix: string; lgd: string }>>("pincode_prefix.json") ?? [];
  const dj = readRefData<Array<{ lgd: string; lgdName?: string; aliases?: string[] }>>("districts.json") ?? [];
  const extra = new Map(dj.map((d) => [d.lgd, d]));

  let lastNominatim = 0;
  const geocoder: Geocoder = new Geocoder({
    districts: districts.map((d) => ({
      lgd: d.lgd_code, nameEn: d.name_en, nameMr: d.name_mr, lgdName: extra.get(d.lgd_code)?.lgdName, aliases: extra.get(d.lgd_code)?.aliases,
    })),
    aliases: aliases.map((a) => ({ alias: a.alias, lgd: a.lgd_code, source: a.source })),
    pincodePrefixes: prefixes,
    async lookupPincode(pin) {
      const [c] = await sql<Array<{ district_name: string | null; state: string | null }>>`
        select district_name, state from ks.geo_pincode where pincode = ${pin}`;
      if (c) return c.district_name && c.state ? { district: c.district_name, state: c.state } : null;
      const r = await getJson<Array<{ Status: string; PostOffice: Array<{ District: string; State: string }> | null }>>(
        `https://api.postalpincode.in/pincode/${pin}`, { timeoutMs: 10_000 });
      stats.indiapost++;
      const po = r.body?.[0]?.Status === "Success" ? r.body[0].PostOffice?.[0] : undefined;
      const lgd = po ? geocoder.matchDistrictName(po.District) : null;
      if (r.status === 200) {
        await sql`insert into ks.geo_pincode (pincode, lgd_code, district_name, state)
                  values (${pin}, ${lgd}, ${po?.District ?? null}, ${po?.State ?? null}) on conflict (pincode) do nothing`;
      }
      return po ? { district: po.District, state: po.State } : null;
    },
    async nominatim(q) {
      const wait = 1100 - (Date.now() - lastNominatim);
      if (wait > 0) await sleep(wait);
      lastNominatim = Date.now();
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
      const r = await getJson<Array<{ address?: Record<string, string> }>>(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, timeoutMs: 15_000 });
      stats.nominatim++;
      const a = r.body?.[0]?.address;
      if (!a) return null;
      return { district: a.state_district ?? a.county ?? a.city ?? null, state: a.state ?? null };
    },
  });
  return geocoder;
}

/** Record geocoder API usage in source_health (called once per ingest run). */
export async function logGeoHealth(sql: Sql, stats: GeoStats): Promise<void> {
  if (stats.indiapost) await logHealth(sql, { sourceId: "indiapost", ok: true, rows: stats.indiapost, requests: stats.indiapost, note: "pincode lookups" });
  if (stats.nominatim) await logHealth(sql, { sourceId: "nominatim", ok: true, rows: stats.nominatim, requests: stats.nominatim, note: "fallback geocodes" });
}
