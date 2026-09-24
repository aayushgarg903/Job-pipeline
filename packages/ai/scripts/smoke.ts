// Live smoke test, a handful of API calls. Usage:
//   pnpm --filter @ks/ai exec tsx scripts/smoke.ts [extract|embed|candidate|narrate ...]
// Set KS_MODEL / KS_MODEL_FALLBACKS to pin a model (e.g. when the primary is out of quota).
import { createEmbedder, createExtractor, narrateDetailed } from "../src/index";

const want = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ["extract", "embed"]);
const ex = createExtractor({
  retriesPerModel: 1,
  onAttempt: (a) => console.log("  attempt", a.model, a.ok ? "ok" : "fail", a.status, `${a.ms}ms`, a.error ?? ""),
});
const catalog = [
  { id: "electrical-wiring", labelEn: "Electrical wiring" },
  { id: "solar-pv-installation", labelEn: "Solar PV installation" },
  { id: "inverter-installation", labelEn: "Inverter and battery installation" },
  { id: "cnc-turning", labelEn: "CNC turning" },
  { id: "cnc-programming-fanuc", labelEn: "Fanuc CNC controls and programming" },
  { id: "docker", labelEn: "Docker" },
];

if (want.has("extract")) {
  const r = await ex.extractPosting({
    title: "CNC Operator",
    description: "Wanted CNC turning operator for Chakan plant. Must know Fanuc controls. Docker not required. 2 years experience preferred.",
    skillsCatalog: catalog,
    occupations: [{ nco: "7223.0100", titleEn: "CNC machine operator" }, { nco: "2512.0100", titleEn: "Software developer" }],
  });
  console.log("extract:", JSON.stringify(r, null, 1));
}

if (want.has("embed")) {
  const em = createEmbedder();
  const v = await em.embed(["solar panel installation", "सोलर पॅनल बसवणे"]);
  const dot = v[0]!.reduce((s, x, i) => s + x * v[1]![i]!, 0);
  console.log("embed: dims", v.map((x) => x.length), "norm", Math.hypot(...v[0]!).toFixed(4), "cos(en,mr)", dot.toFixed(3), em.stats());
}

if (want.has("candidate")) {
  const text = "मला wiring आणि solar panel बसवता येतं, inverter पण थोडं थोडं येतं";
  console.log("candidate:", text, "->", JSON.stringify(await ex.parseCandidateSkills({ text, lang: "mr", skillsCatalog: catalog })));
}

if (want.has("narrate")) {
  const facts = {
    course: "Electrician (NCVT)", district: "Nashik", districtMr: "नाशिक", skill: "solar PV installation", skillMr: "सोलर पीव्ही बसवणे",
    demand: 140, supply: 35, employers: 14, postings: 22, hoursAdded: 60, dropSkill: "DC generator repair", hoursDropped: 48,
  };
  const out = await narrateDetailed({ router: ex.router }, { kind: "pr-rationale", facts, lang: "mr" });
  console.log("narrate (mr):", JSON.stringify(out, null, 1));
}
console.log("API calls:", ex.router.attempts().length);
