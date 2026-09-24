// Local stand-in for @ks/core's SDI + gap (Architecture §6.1–6.2), simplified and documented:
//  1. per signal k, rates per 100k population r(d,o) are shrunk district → division → state with m_k
//  2. non-anchor signals are LEVEL-CALIBRATED to the Udyam anchor (their state total is rescaled to
//     Udyam's), so postings/surveys shape the occupation × district mix but cannot swing the level.
//     Weights are renormalised over signals that have any data in the quarter.
//  3. demand(d,s,≥p) = Σ_o hires(d,o) · P(s|o) · [req(o,s) ≥ p];  supply via spill-over M
//  4. SDI = 100 · demand / state-average demand in the base quarter; CI by a delta-method approximation.
import type { DemandCell, SignalKind } from "@ks/contracts";
import type { DemandFactOut, DistrictMetricOut, EngineInput, EngineOutput, OccupationCell, SupplyFactOut } from "./types";

const PER = 100_000;
const KINDS: SignalKind[] = ["udyam", "postings", "surveys", "consultations"];
const key = (...xs: Array<string | number>) => xs.join("|");

export function computeCells(inp: EngineInput): EngineOutput {
  const pop = new Map(inp.districts.map((d) => [d.lgd, Math.max(1, d.population)]));
  const divOf = new Map(inp.districts.map((d) => [d.lgd, d.division]));
  const divisions = [...new Set(inp.districts.map((d) => d.division))];
  const divPop = new Map(divisions.map((v) => [v, inp.districts.filter((d) => d.division === v).reduce((s, d) => s + pop.get(d.lgd)!, 0)]));
  const statePop = [...pop.values()].reduce((a, b) => a + b, 0);
  const nD = inp.districts.length;

  const byProfile = new Map<string, Array<{ skillId: string; weight: number; proficiency: number }>>();
  for (const p of inp.profiles) {
    if (!byProfile.has(p.nco)) byProfile.set(p.nco, []);
    byProfile.get(p.nco)!.push(p);
  }
  const occs = [...byProfile.keys()];

  // Spill-over: supply located in `from` serves `to`.
  const spillTo = new Map<string, Array<{ from: string; share: number }>>();
  for (const s of inp.spill) {
    if (!spillTo.has(s.to)) spillTo.set(s.to, []);
    spillTo.get(s.to)!.push({ from: s.from, share: s.share });
  }
  const localSupply = new Map<string, { c: number; e: number }>();
  for (const s of inp.supply) {
    for (let p = 1; p <= s.proficiency; p++) {
      const k = key(s.lgd, s.skillId, p);
      const cur = localSupply.get(k) ?? { c: 0, e: 0 };
      localSupply.set(k, { c: cur.c + s.completers, e: cur.e + s.estimated });
    }
  }
  const localOcc = new Map<string, number>();
  for (const s of inp.occSupply) localOcc.set(key(s.lgd, s.nco), (localOcc.get(key(s.lgd, s.nco)) ?? 0) + s.completers);
  const served = <T>(lgd: string, get: (from: string) => T, add: (a: T, b: T, share: number) => T, zero: T): T =>
    (spillTo.get(lgd) ?? [{ from: lgd, share: 1 }]).reduce((acc, { from, share }) => add(acc, get(from), share), zero);

  const cells: DemandCell[] = [];
  const occupationCells: OccupationCell[] = [];
  const districtMetrics: DistrictMetricOut[] = [];
  const demandFacts: DemandFactOut[] = [];
  const supplyFacts: SupplyFactOut[] = [];
  const baseAvg = new Map<string, number>(); // skill|p → state-average demand in base quarter
  const quarterDemand = new Map<string, Map<string, number>>(); // quarter → lgd|skill|p → demand
  const quarterRse = new Map<string, Map<string, number>>();
  const quarterCov = new Map<string, Map<string, number>>();

  for (const q of inp.quarters) {
    const obs = inp.observations.filter((o) => o.quarter === q);
    const hires = new Map<string, number>(); // lgd|nco → fused hires
    const varTerm = new Map<string, number>(); // lgd → Σ (w H)^2 / (n + m)
    const cov = new Map<string, number>();
    const perSignal = new Map<SignalKind, Map<string, number>>();
    const nBy = new Map<SignalKind, Map<string, number>>();

    for (const k of KINDS) {
      const o = obs.filter((x) => x.kind === k);
      if (!o.length) continue;
      const m = inp.priorStrength[k];
      const nd = new Map<string, number>(); const hd = new Map<string, number>();
      const hDiv = new Map<string, number>(); const nDiv = new Map<string, number>(); const hState = new Map<string, number>();
      let nState = 0;
      for (const x of o) {
        const div = divOf.get(x.lgd); if (!div) continue;
        nd.set(x.lgd, (nd.get(x.lgd) ?? 0) + x.n);
        hd.set(key(x.lgd, x.nco), (hd.get(key(x.lgd, x.nco)) ?? 0) + x.hires12m);
        hDiv.set(key(div, x.nco), (hDiv.get(key(div, x.nco)) ?? 0) + x.hires12m);
        nDiv.set(div, (nDiv.get(div) ?? 0) + x.n);
        hState.set(x.nco, (hState.get(x.nco) ?? 0) + x.hires12m);
        nState += x.n;
      }
      const est = new Map<string, number>();
      for (const d of inp.districts) {
        const div = d.division; const nDv = nDiv.get(div) ?? 0; const n = nd.get(d.lgd) ?? 0;
        for (const nco of occs) {
          const rState = ((hState.get(nco) ?? 0) / statePop) * PER;
          const rDivRaw = ((hDiv.get(key(div, nco)) ?? 0) / divPop.get(div)!) * PER;
          const rDiv = (nDv * rDivRaw + m * rState) / (nDv + m);
          const rD = ((hd.get(key(d.lgd, nco)) ?? 0) / pop.get(d.lgd)!) * PER;
          const r = (n * rD + m * rDiv) / (n + m);
          if (r > 0) est.set(key(d.lgd, nco), (r * pop.get(d.lgd)!) / PER);
        }
      }
      if (nState > 0) { perSignal.set(k, est); nBy.set(k, nd); }
    }

    // Level calibration to the anchor (udyam); fall back to the largest signal if udyam is absent.
    const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const anchor = perSignal.get("udyam") ?? [...perSignal.values()].sort((a, b) => total(b) - total(a))[0];
    const anchorTotal = anchor ? total(anchor) : 0;
    const active = [...perSignal.keys()];
    const wSum = active.reduce((s, k) => s + inp.weights[k], 0) || 1;
    for (const k of active) {
      const est = perSignal.get(k)!;
      const scale = total(est) > 0 ? anchorTotal / total(est) : 0;
      const w = inp.weights[k] / wSum;
      const nd = nBy.get(k)!;
      const dTot = new Map<string, number>();
      for (const [kk, v] of est) {
        const [lgd, nco] = kk.split("|") as [string, string];
        const h = v * scale;
        hires.set(kk, (hires.get(kk) ?? 0) + w * h);
        dTot.set(lgd, (dTot.get(lgd) ?? 0) + h);
        demandFacts.push({ quarter: q, lgd, nco, signal: k, n: 0, hires12m: h });
      }
      for (const d of inp.districts) {
        const n = nd.get(d.lgd) ?? 0; const m = inp.priorStrength[k];
        varTerm.set(d.lgd, (varTerm.get(d.lgd) ?? 0) + (w * (dTot.get(d.lgd) ?? 0)) ** 2 / (n + m));
      }
    }
    for (const d of inp.districts) {
      let c = 0;
      for (const k of KINDS) { const n = nBy.get(k)?.get(d.lgd) ?? 0; c += inp.weights[k] * (n / (n + inp.priorStrength[k])); }
      cov.set(d.lgd, Math.min(1, c));
    }
    // Attach observation counts to the per-signal facts.
    for (const f of demandFacts) if (f.quarter === q) f.n = obs.filter((o) => o.kind === f.signal && o.lgd === f.lgd && o.nco === f.nco).reduce((s, o) => s + o.n, 0);

    const qDemand = new Map<string, number>();
    const rseBy = new Map<string, number>();
    for (const d of inp.districts) {
      let occDemandSum = 0, absGap = 0;
      for (const nco of occs) {
        const h = hires.get(key(d.lgd, nco)) ?? 0;
        const sup = served(d.lgd, (f) => localOcc.get(key(f, nco)) ?? 0, (a, b, s) => a + b * s, 0);
        occDemandSum += h; absGap += Math.abs(h - sup);
        if (h > 0 || sup > 0) occupationCells.push({ quarter: q, lgd: d.lgd, nco, demand: h, supply: sup });
        for (const pr of byProfile.get(nco)!) {
          for (let p = 1; p <= pr.proficiency; p++) {
            const kk = key(d.lgd, pr.skillId, p);
            qDemand.set(kk, (qDemand.get(kk) ?? 0) + h * pr.weight);
          }
        }
      }
      const H = occDemandSum;
      rseBy.set(d.lgd, H > 0 ? Math.sqrt(varTerm.get(d.lgd) ?? 0) / H : 1);
      districtMetrics.push({ quarter: q, lgd: d.lgd, mismatch: H > 0 ? Math.min(1, absGap / H) : 0, coverage: cov.get(d.lgd) ?? 0 });
    }
    quarterDemand.set(q, qDemand);
    quarterRse.set(q, rseBy);
    quarterCov.set(q, cov);
    if (q === inp.baseQuarter) {
      for (const [kk, v] of qDemand) {
        const [, s, p] = kk.split("|");
        baseAvg.set(key(s!, p!), (baseAvg.get(key(s!, p!)) ?? 0) + v / nD);
      }
    }
  }

  for (const q of inp.quarters) {
    const qDemand = quarterDemand.get(q)!;
    const keys = new Set([...qDemand.keys(), ...localSupplyKeys(inp, localSupply)]);
    for (const kk of keys) {
      const [lgd, skillId, pS] = kk.split("|") as [string, string, string];
      const p = Number(pS);
      const demand = qDemand.get(kk) ?? 0;
      const sup = served(lgd, (f) => localSupply.get(key(f, skillId, p)) ?? { c: 0, e: 0 },
        (a, b, s) => ({ c: a.c + b.c * s, e: a.e + b.e * s }), { c: 0, e: 0 });
      if (demand < 0.5 && sup.c < 0.5) continue;
      const base = baseAvg.get(key(skillId, p)) ?? 0;
      const sdi = base > 0 ? (100 * demand) / base : 0;
      const rse = Math.min(1, quarterRse.get(q)!.get(lgd) ?? 1);
      cells.push({
        lgd, skillId, proficiency: p as DemandCell["proficiency"], quarter: q,
        demand: round(demand), supply: round(sup.c), gap: round(demand - sup.c), ratio: round(demand / Math.max(sup.c, 1), 3),
        sdi: round(sdi), ciLow: round(sdi * Math.max(0, 1 - 1.96 * rse)), ciHigh: round(sdi * (1 + 1.96 * rse)),
        coverage: round(quarterCov.get(q)!.get(lgd) ?? 0, 3),
      });
      if (sup.c > 0) supplyFacts.push({ quarter: q, lgd, skillId, proficiency: p, graduates: round(sup.c), estimatedShare: round(sup.c > 0 ? sup.e / sup.c : 0, 3) });
    }
  }
  return { cells, occupationCells, districtMetrics, demandFacts, supplyFacts };
}

function localSupplyKeys(inp: EngineInput, local: Map<string, { c: number }>): string[] {
  // Every district that receives spill-over supply gets a key, even with no local courses.
  const out: string[] = [];
  const skillsP = new Set([...local.keys()].map((k) => k.split("|").slice(1).join("|")));
  for (const d of inp.districts) for (const sp of skillsP) out.push(`${d.lgd}|${sp}`);
  return out;
}

const round = (x: number, dp = 1) => Math.round(x * 10 ** dp) / 10 ** dp;
