// State-level PMKVY / ITI supply apportioned to districts by Udyam weight. ALWAYS ESTIMATED.
// State totals are approximate published aggregates (DVET Maharashtra ITI seating capacity; PMKVY
// certifications per year from the Skill India dashboard, 2022-24 average), rounded, and the trade
// mix is a documented prior. Demo institutes' seats are subtracted so they are never double counted.
import type { Sql } from "@ks/db";
import { insertMany } from "./store";

export const ESTIMATE_FY = "FY26";

/** Completers per year, state of Maharashtra (approximate). */
export const STATE_TOTALS = {
  ITI: { completers: 110_000, placedRate: 0.45, note: "≈1.48 lakh ITI seats (≈420 govt + ≈560 private ITIs, DVET), ≈75% completion" },
  PMKVY: { completers: 90_000, placedRate: 0.35, note: "≈0.9 lakh PMKVY certifications/year in MH (Skill India dashboard, 2022-24 avg)" },
} as const;

/** Trade mix prior (share of scheme completers), keyed by trade code in trades.json. */
export const TRADE_MIX: Record<"ITI" | "PMKVY", Record<string, number>> = {
  ITI: {
    "CTS-ELEC": 0.18, "CTS-FITT": 0.14, "CTS-COPA": 0.1, "CTS-WELD": 0.08, "CTS-MMV": 0.07, "CTS-WIRE": 0.05,
    "CTS-TURN": 0.05, "CTS-MACH": 0.05, "CTS-MDSL": 0.05, "CTS-ELMC": 0.05, "CTS-RACT": 0.04, "CTS-DMEC": 0.03,
    "CTS-TDM": 0.02, "CTS-STEN": 0.02, "CTS-FPG": 0.02, "CTS-HSI": 0.02, "CTS-SOLE": 0.01, "CTS-MEV": 0.01, "CTS-IOTS": 0.005, "CTS-DRON": 0.005,
  },
  PMKVY: {
    "PMK-GDA": 0.14, "PMK-DEO": 0.16, "PMK-CCE": 0.14, "PMK-WHP": 0.1, "PMK-FORK": 0.04, "PMK-SURY": 0.06, "PMK-CNCT": 0.06,
    "PMK-JSD": 0.08, "PMK-FSS": 0.04, "PMK-FVP": 0.06, "PMK-PHLB": 0.06, "PMK-EVCS": 0.06,
  },
};

export async function buildSupplyEstimates(sql: Sql): Promise<number> {
  const weights = await sql<{ lgd_code: string; w: number }[]>`
    select lgd_code, total::float8 / sum(total) over () as w from ks.udyam_district_total`;
  if (!weights.length) return 0;
  const trades = await sql<{ qp_code: string; nco_code: string }[]>`select qp_code, nco_code from ks.qualification`;
  const ncoOf = new Map(trades.map((t) => [t.qp_code, t.nco_code]));
  const demo = await sql<{ lgd_code: string; target_nco: string; kind: string; seats: number }[]>`
    select i.lgd_code, c.target_nco, c.kind, sum(c.seats)::int as seats from ks.course c join ks.institution i on i.id = c.institution_id
    group by 1, 2, 3`;
  const demoSeats = new Map(demo.map((d) => [`${d.lgd_code}|${d.target_nco}|${d.kind}`, d.seats]));

  const rows: Array<Record<string, unknown>> = [];
  for (const scheme of ["ITI", "PMKVY"] as const) {
    const st = STATE_TOTALS[scheme];
    const agg = new Map<string, number>(); // lgd|nco → trained
    for (const [code, share] of Object.entries(TRADE_MIX[scheme])) {
      const nco = ncoOf.get(code);
      if (!nco) continue;
      for (const w of weights) {
        const k = `${w.lgd_code}|${nco}`;
        agg.set(k, (agg.get(k) ?? 0) + st.completers * share * w.w);
      }
    }
    for (const [k, trained] of agg) {
      const [lgd, nco] = k.split("|") as [string, string];
      const sub = (demoSeats.get(`${lgd}|${nco}|${scheme}`) ?? 0) * 0.8;
      const t = Math.max(0, trained - sub);
      if (t < 1) continue;
      rows.push({
        fy: ESTIMATE_FY, lgd_code: lgd, scheme, nco_code: nco, trained: Math.round(t), placed: Math.round(t * st.placedRate),
        provenance: sql.json({
          method: "state completers × trade-mix prior × district share of Udyam registrations, minus demo-institute seats",
          stateCompleters: st.completers, stateNote: st.note, isEstimated: true,
        }),
        is_estimated: true,
      });
    }
  }
  await sql.begin(async (tx) => {
    await tx`delete from ks.supply_estimate where fy = ${ESTIMATE_FY}`;
    await insertMany(tx as unknown as Sql, "supply_estimate", rows, ["fy", "lgd_code", "scheme", "nco_code", "trained", "placed", "provenance", "is_estimated"], 1000);
  });
  return rows.length;
}
