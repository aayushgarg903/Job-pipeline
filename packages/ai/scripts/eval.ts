// Golden-set eval for the extractor. Runs every posting through the real model
// (one call each unless a retry/fallback is needed) and prints skill P/R/F1,
// negation accuracy, NCO accuracy, and injection resistance.
//
//   pnpm --filter @ks/ai eval                     # all 30 postings
//   pnpm --filter @ks/ai eval -- --ids P01,P09    # a subset
//   pnpm --filter @ks/ai eval -- --rescore        # re-score the saved run, no API calls
import type { ExtractedPosting } from "@ks/contracts";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLimiter, createRouter, type Attempt } from "../src/client";
import { extractPostingDetailed, postProcess, type ExtractInput, type RawExtraction, type VerifyStats } from "../src/extract";

type GoldSkill = { id: string; negated?: boolean };
type Golden = {
  id: string; sector: string; city: string; lang: "en" | "mr" | "mixed"; tags: string[];
  title: string; description: string;
  gold: { nco: string; ncoAlt?: string[]; workMode?: string; skills: GoldSkill[]; acceptable: string[] };
  injection?: { forbiddenSkillIds: string[]; forbiddenNco?: string; forbiddenWorkMode?: string; mustHaveSkillIds: string[] };
};
type RunRow = { id: string; ok: boolean; error?: string; model?: string; raw?: RawExtraction; ms?: number };

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "data");
const catalog = JSON.parse(readFileSync(join(dataDir, "eval-catalog.json"), "utf8")) as { skills: ExtractInput["skillsCatalog"]; occupations: ExtractInput["occupations"] };
const golden = (JSON.parse(readFileSync(join(dataDir, "golden-postings.json"), "utf8")) as { postings: Golden[] }).postings;
const lastRunPath = join(dataDir, "eval-last-run.json");

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
type SavedRun = { runs: Array<{ ranAt: string; ids: string[]; calls: number }>; attempts: Attempt[]; rows: RunRow[]; metrics?: unknown };
const loadSaved = (): SavedRun | null => {
  try { return JSON.parse(readFileSync(lastRunPath, "utf8")) as SavedRun; } catch { return null; }
};
const rescore = args.includes("--rescore");
const onlyFailed = args.includes("--only-failed");
const ids = onlyFailed ? loadSaved()?.rows.filter((r) => !r.ok).map((r) => r.id) : flag("--ids")?.split(",");
const concurrency = Number(flag("--concurrency") ?? 3);
const selected = golden.filter((g) => !ids || ids.includes(g.id));

const inputOf = (g: Golden): ExtractInput => ({ title: g.title, description: g.description, skillsCatalog: catalog.skills, occupations: catalog.occupations });

// ---------------------------------------------------------------- run
async function runLive(): Promise<{ rows: RunRow[]; attempts: readonly Attempt[] }> {
  const router = createRouter({
    retriesPerModel: 1, // keep API use modest: 2 tries per model, then fall back
    timeoutMs: 90_000, // overloaded flash-lite answers slowly; a timeout wastes the call
    onAttempt: (a) => { if (!a.ok) console.error(`  [${a.model}] ${a.status ?? ""} ${a.error ?? ""}`); },
  });
  const limit = createLimiter(concurrency);
  let done = 0;
  const rows = await Promise.all(selected.map((g) => limit(async (): Promise<RunRow> => {
    const t0 = Date.now();
    try {
      const r = await extractPostingDetailed({ router }, inputOf(g));
      console.error(`${String(++done).padStart(2)}/${selected.length} ${g.id} ok via ${r.posting.model} (${Date.now() - t0} ms)`);
      return { id: g.id, ok: true, model: r.posting.model, raw: r.raw, ms: Date.now() - t0 };
    } catch (err) {
      console.error(`${String(++done).padStart(2)}/${selected.length} ${g.id} FAILED: ${String((err as Error).message).slice(0, 200)}`);
      return { id: g.id, ok: false, error: String((err as Error).message), ms: Date.now() - t0 };
    }
  })));
  return { rows, attempts: router.attempts() };
}

// ---------------------------------------------------------------- score
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "n/a");
const prf = (tp: number, fp: number, fn: number) => {
  const p = tp / (tp + fp), r = tp / (tp + fn);
  return { p, r, f1: (2 * p * r) / (p + r) };
};

function predMap(p: ExtractedPosting): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const s of p.skills) if (s.skillId) m.set(s.skillId, (m.get(s.skillId) ?? false) || s.negated);
  return m;
}

function score(rows: RunRow[]) {
  const byGroup = new Map<string, { tp: number; fp: number; fn: number }>();
  const bump = (k: string, d: { tp: number; fp: number; fn: number }) => {
    const c = byGroup.get(k) ?? { tp: 0, fp: 0, fn: 0 };
    c.tp += d.tp; c.fp += d.fp; c.fn += d.fn; byGroup.set(k, c);
  };
  const neg = { matched: 0, correct: 0, goldNeg: 0, goldNegHit: 0, falseNeg: 0 };
  const nco = { n: 0, strict: 0, withAlt: 0 };
  const verify: VerifyStats = { exact: 0, recovered: 0, relocated: 0, dropped: 0, injected: 0 };
  const injection: Array<{ id: string; model: boolean; final: boolean; notes: string[] }> = [];
  const perPosting: Array<{ id: string; tp: number; fp: number; fn: number; nco: string | null; goldNco: string; fps: string[]; fns: string[] }> = [];

  for (const row of rows) {
    const g = golden.find((x) => x.id === row.id)!;
    if (!row.ok || !row.raw) continue;
    const { posting, stats } = postProcess(row.raw, inputOf(g), row.model ?? "?");
    (Object.keys(verify) as Array<keyof VerifyStats>).forEach((k) => { verify[k] += stats[k]; });
    const pred = predMap(posting);
    const gold = new Map(g.gold.skills.map((s) => [s.id, s.negated ?? false]));
    const ok = new Set(g.gold.acceptable);
    const fps = [...pred.keys()].filter((k) => !gold.has(k) && !ok.has(k));
    const fns = [...gold.keys()].filter((k) => !pred.has(k));
    const tp = [...pred.keys()].filter((k) => gold.has(k)).length;
    const d = { tp, fp: fps.length, fn: fns.length };
    bump("all", d); bump(`sector:${g.sector}`, d); bump(`lang:${g.lang === "en" ? "en" : "mr/mixed"}`, d);
    perPosting.push({ id: g.id, ...d, nco: posting.nco, goldNco: g.gold.nco, fps, fns });

    for (const [id, goldNeg] of gold) {
      if (goldNeg) neg.goldNeg++;
      if (!pred.has(id)) continue;
      neg.matched++;
      if (pred.get(id) === goldNeg) neg.correct++;
      if (goldNeg && pred.get(id)) neg.goldNegHit++;
      if (!goldNeg && pred.get(id)) neg.falseNeg++;
    }
    nco.n++;
    if (posting.nco === g.gold.nco) nco.strict++;
    if (posting.nco === g.gold.nco || (posting.nco && g.gold.ncoAlt?.includes(posting.nco))) nco.withAlt++;

    if (g.injection) {
      const inj = g.injection;
      const check = (skillIds: string[], ncoCode: string | null, mode: string) => {
        const notes: string[] = [];
        for (const f of inj.forbiddenSkillIds) if (skillIds.includes(f)) notes.push(`has forbidden ${f}`);
        if (inj.forbiddenNco && ncoCode === inj.forbiddenNco) notes.push(`nco hijacked to ${ncoCode}`);
        if (inj.forbiddenWorkMode && mode === inj.forbiddenWorkMode) notes.push(`workMode hijacked to ${mode}`);
        for (const m of inj.mustHaveSkillIds) if (!skillIds.includes(m)) notes.push(`lost ${m}`);
        return notes;
      };
      const rawNotes = check(row.raw.skills.map((s) => s.skillId ?? ""), row.raw.nco, row.raw.workMode);
      const finalNotes = check(posting.skills.map((s) => s.skillId ?? ""), posting.nco, posting.workMode);
      injection.push({ id: g.id, model: rawNotes.length === 0, final: finalNotes.length === 0, notes: [...rawNotes.map((n) => `model: ${n}`), ...finalNotes.map((n) => `final: ${n}`)] });
    }
  }
  return { byGroup, neg, nco, verify, injection, perPosting };
}

function report(rows: RunRow[], attempts: readonly Attempt[] | null) {
  const s = score(rows);
  const okRows = rows.filter((r) => r.ok);
  console.log(`\n=== @ks/ai extraction eval: ${okRows.length}/${rows.length} postings extracted ===`);
  const all = s.byGroup.get("all") ?? { tp: 0, fp: 0, fn: 0 };
  const m = prf(all.tp, all.fp, all.fn);
  console.log(`\nSkills (micro, catalogue ids)  P ${pct(m.p)}  R ${pct(m.r)}  F1 ${pct(m.f1)}   (tp ${all.tp}, fp ${all.fp}, fn ${all.fn})`);
  for (const [k, v] of [...s.byGroup].filter(([k]) => k !== "all").sort()) {
    const x = prf(v.tp, v.fp, v.fn);
    console.log(`  ${k.padEnd(20)} P ${pct(x.p).padStart(6)}  R ${pct(x.r).padStart(6)}  F1 ${pct(x.f1).padStart(6)}`);
  }
  console.log(`\nNegation  accuracy on matched skills ${pct(s.neg.correct / s.neg.matched)} (${s.neg.correct}/${s.neg.matched})`);
  console.log(`          negated gold skills caught ${s.neg.goldNegHit}/${s.neg.goldNeg}, false negations ${s.neg.falseNeg}`);
  console.log(`NCO       accuracy ${pct(s.nco.withAlt / s.nco.n)} (${s.nco.withAlt}/${s.nco.n}; strict primary-code ${s.nco.strict}/${s.nco.n})`);
  const injModel = s.injection.filter((i) => i.model).length, injFinal = s.injection.filter((i) => i.final).length;
  console.log(`Injection resisted: model alone ${injModel}/${s.injection.length}, after code checks ${injFinal}/${s.injection.length}`);
  for (const i of s.injection) console.log(`  ${i.id}: ${i.notes.length ? i.notes.join("; ") : "clean"}`);
  const v = s.verify;
  console.log(`Evidence  exact ${v.exact}, recovered ${v.recovered}, re-located ${v.relocated}, dropped ${v.dropped}, dropped-as-injection ${v.injected}`);

  console.log(`\nPer posting (fp / fn):`);
  for (const p of s.perPosting) {
    const flagNco = p.nco === p.goldNco ? "" : `  nco ${p.nco} (gold ${p.goldNco})`;
    if (p.fps.length || p.fns.length || flagNco) console.log(`  ${p.id}: +[${p.fps.join(", ")}] -[${p.fns.join(", ")}]${flagNco}`);
  }
  const models = new Map<string, number>();
  okRows.forEach((r) => models.set(r.model ?? "?", (models.get(r.model ?? "?") ?? 0) + 1));
  console.log(`\nAnswered by: ${[...models].map(([k, n]) => `${k} x${n}`).join(", ")}`);
  const lat = okRows.map((r) => r.ms ?? 0).sort((a, b) => a - b);
  if (lat.length) console.log(`Latency per posting: median ${lat[Math.floor(lat.length / 2)]} ms, max ${lat[lat.length - 1]} ms`);
  if (attempts) {
    const byModel = new Map<string, { ok: number; fail: Map<string, number> }>();
    for (const a of attempts) {
      const e = byModel.get(a.model) ?? { ok: 0, fail: new Map() };
      if (a.ok) e.ok++; else e.fail.set(String(a.status ?? "err"), (e.fail.get(String(a.status ?? "err")) ?? 0) + 1);
      byModel.set(a.model, e);
    }
    console.log(`API calls: ${attempts.length} total`);
    for (const [k, e] of byModel) console.log(`  ${k}: ${e.ok} ok${[...e.fail].map(([st, n]) => `, ${n} x ${st}`).join("")}`);
  }
  return { skills: { ...m, ...all }, negation: s.neg, nco: s.nco, injection: s.injection, evidence: s.verify };
}

// ---------------------------------------------------------------- main
if (rescore) {
  const saved = loadSaved();
  if (!saved) throw new Error(`no saved run at ${lastRunPath}`);
  report(saved.rows.filter((r) => !ids || ids.includes(r.id)), saved.attempts);
  for (const r of saved.runs ?? []) console.log(`  run ${r.ranAt}: ${r.ids.length} postings, ${r.calls} API calls`);
} else {
  console.error(`Running ${selected.length} postings, concurrency ${concurrency}...`);
  const { rows, attempts } = await runLive();
  // A partial run (--ids / --only-failed) replaces those rows in the saved run; call counts accumulate.
  const prev = ids ? loadSaved() : null;
  const merged = prev ? [...prev.rows.filter((r) => !rows.some((x) => x.id === r.id)), ...rows] : rows;
  merged.sort((a, b) => a.id.localeCompare(b.id));
  const allAttempts = [...(prev?.attempts ?? []), ...attempts];
  const earlier = prev?.runs ?? (prev ? [{ ranAt: (prev as { ranAt?: string }).ranAt ?? "?", ids: prev.rows.map((r) => r.id), calls: prev.attempts.length }] : []);
  const runs = [...earlier, { ranAt: new Date().toISOString(), ids: selected.map((g) => g.id), calls: attempts.length }];
  console.log(prev ? `\n(This run: ${attempts.length} API calls. Report below covers the merged run.)` : "");
  const metrics = report(merged, allAttempts);
  writeFileSync(lastRunPath, `${JSON.stringify({ runs, metrics, attempts: allAttempts, rows: merged })}\n`);
  console.log(`\nSaved raw outputs to ${lastRunPath} (re-score with --rescore)`);
}
