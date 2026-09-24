// OpenAlex works per publication year: the real global series behind the curated Emerging-tech Radar.
import type { Sql } from "@ks/db";
import { type SourceAdapter, healthFromLog, logHealth, storeRaw } from "../store";
import { getJson, sleep } from "../util";

/** Curated terms (Plan §M4). `skill` is a catalogue skill id; null in the DB if it isn't in the catalogue. */
export const RADAR_TERMS: Array<{ term: string; search: string; skill: string; note: string }> = [
  { term: "Battery management systems", search: "battery management system", skill: "battery-management-systems",
    note: "EV supply chain around Chakan and Chh. Sambhajinagar; few MH ITI syllabi cover BMS yet" },
  { term: "EV charging infrastructure", search: "electric vehicle charging station", skill: "ev-charging-installation",
    note: "State EV policy 2025 targets charging corridors; electricians need EVSE installation skills" },
  { term: "Rooftop solar PV", search: "rooftop solar photovoltaic", skill: "solar-pv-installation",
    note: "PM Surya Ghar drives rooftop installs; Suryamitra is the matching PMKVY role" },
  { term: "Industrial IoT", search: "industrial internet of things", skill: "iot-systems",
    note: "Predictive maintenance on Pune/Nashik shop floors" },
  { term: "Collaborative robots", search: "collaborative robot manufacturing", skill: "industrial-robotics",
    note: "Cobot cells in auto-component MSMEs" },
  { term: "Cold chain logistics", search: "cold chain logistics", skill: "cold-chain-management",
    note: "Nashik onion/grape and dairy value chains" },
  { term: "Business intelligence dashboards", search: "business intelligence dashboard", skill: "power-bi",
    note: "Data-analyst postings in Pune ask for Power BI" },
  { term: "Additive manufacturing", search: "additive manufacturing", skill: "additive-manufacturing",
    note: "Tooling and prototyping in capital goods" },
  { term: "Drones for agriculture", search: "agricultural drone", skill: "drone-assembly",
    note: "Kisan drone scheme; DGT runs a Drone Technician trade" },
  { term: "Generative AI", search: "large language model", skill: "generative-ai",
    note: "Global surge; MH postings still mostly outside the focus trades" },
];

export function createOpenAlexAdapter(sql: Sql): SourceAdapter {
  return {
    id: "openalex",
    health: healthFromLog(sql, "openalex"),
    async fetch() {
      let requests = 0, ok = 0;
      const thisYear = new Date().getUTCFullYear();
      for (const t of RADAR_TERMS) {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(t.search)}&group_by=publication_year&per_page=200`;
        const r = await getJson<{ group_by?: Array<{ key: string; count: number }> }>(url, { timeoutMs: 30_000 });
        requests++;
        if (r.status !== 200 || !r.body?.group_by) continue;
        await storeRaw(sql, "openalex", `${t.term}:${new Date().toISOString().slice(0, 10)}`, r.body.group_by);
        const series = r.body.group_by
          .map((g) => ({ period: g.key, value: g.count }))
          .filter((g) => Number(g.period) >= thisYear - 9 && Number(g.period) < thisYear) // full years only
          .sort((a, b) => a.period.localeCompare(b.period));
        const [skill] = await sql<{ id: string }[]>`select id from ks.skill where id = ${t.skill}`;
        await sql`insert into ks.radar_term (term, skill_id, global, global_source, note, fetched_at)
          values (${t.term}, ${skill?.id ?? null}, ${sql.json(series)}, 'OpenAlex works per publication year', ${t.note}, now())
          on conflict (term) do update set skill_id = excluded.skill_id, global = excluded.global, note = excluded.note, fetched_at = now()`;
        ok++;
        await sleep(300);
      }
      const note = `${ok}/${RADAR_TERMS.length} radar terms refreshed`;
      await logHealth(sql, { sourceId: "openalex", ok: ok > 0, rows: ok, requests, note });
      return { rows: ok, requests, note };
    },
  };
}
