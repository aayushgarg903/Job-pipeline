// The one way Server Actions write. Mirrors lib/readers.ts:
// DATA_MODE=fixture -> DEMO writers that keep everything in this server process's memory
// (lost on restart, never shared, clearly labelled demo); otherwise @ks/db's `writers`.
// If @ks/db is missing or doesn't export `writers` yet, we warn once and use the demo store,
// so forms always work in a demo. Never call cookies()/headers() in here.
import type { SurveyInput, Writers } from "@ks/contracts";

// Fixed id of "Nashik demo employer (specimen)", seeded by packages/db/scripts/seed/demo.ts
// (employer ids are uuids; the fixture inbox ignores the id).
export const DEMO_EMPLOYER_ID = "00000000-0000-4000-8000-000000000487";

type Verdict = "endorse" | "change" | "irrelevant";
interface DemoReview { prId: string; employerId: string; verdict: Verdict; comment: string | null; at: string }
interface DemoStore {
  readonly label: "DEMO: in-memory only, forgotten on restart";
  surveys: Array<SurveyInput & { id: string; at: string }>;
  reviews: Map<string, DemoReview>; // key: prId|employerId (one verdict per employer per PR)
  plans: Array<{ id: string; lgd: string; fy: string; signedBy: string | null; at: string }>;
  resolutions: Array<{ id: string; decision: "approve" | "reject"; by: string; at: string }>;
}

// Kept on globalThis so dev-server module reloads don't wipe the demo store mid-session.
const g = globalThis as typeof globalThis & { __ksDemoStore?: DemoStore };

export function demoStore(): DemoStore {
  g.__ksDemoStore ??= {
    label: "DEMO: in-memory only, forgotten on restart",
    surveys: [],
    reviews: new Map(),
    plans: [],
    resolutions: [],
  };
  return g.__ksDemoStore;
}

let seq = 0;
const demoId = (prefix: string) => `demo-${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;
const now = () => new Date().toISOString();

export const fixtureWriters: Writers = {
  async submitSurvey(input) {
    const id = demoId("survey");
    demoStore().surveys.push({ ...structuredClone(input), id, at: now() });
    return { id };
  },
  async reviewPr({ prId, employerId, verdict, comment }) {
    demoStore().reviews.set(`${prId}|${employerId}`, { prId, employerId, verdict, comment, at: now() });
  },
  async savePlan({ lgd, fy, signedBy }) {
    const id = demoId("plan");
    demoStore().plans.push({ id, lgd, fy, signedBy, at: now() });
    return { id };
  },
  async resolveReview({ id, decision, by }) {
    demoStore().resolutions.push({ id, decision, by, at: now() });
  },
};

let resolved: Promise<{ writers: Writers; demo: boolean }> | null = null;
let warned = false;

function warn(msg: string) {
  if (warned) return;
  warned = true;
  console.warn(`[writers] ${msg} Using the DEMO in-memory store (nothing is saved).`);
}

async function load(): Promise<{ writers: Writers; demo: boolean }> {
  if (process.env.DATA_MODE === "fixture") return { writers: fixtureWriters, demo: true };
  try {
    // next.config.ts aliases this to lib/db-missing.ts until packages/db/src/index.ts exists.
    // @ts-ignore -- @ks/db may not have source (or types) yet; resolved at build time.
    const mod = (await import("@ks/db")) as { writers?: Writers } | undefined;
    if (mod?.writers && typeof mod.writers.submitSurvey === "function") return { writers: mod.writers, demo: false };
    warn("@ks/db does not export `writers` yet.");
  } catch (err) {
    warn(`Could not load @ks/db (${err instanceof Error ? err.message : String(err)}).`);
  }
  return { writers: fixtureWriters, demo: true };
}

export async function getWriters(): Promise<Writers> {
  resolved ??= load();
  return (await resolved).writers;
}

/** True when writes go to the demo in-memory store (pages say so). */
export async function writersAreDemo(): Promise<boolean> {
  resolved ??= load();
  return (await resolved).demo;
}

/**
 * Demo-only overlay for the PR inbox: the fixture readers can't see demo writes, so pages add
 * this employer's latest verdict on top of the reader's counts. Zero when writes are real.
 */
export async function demoReviewOverlay(prId: string, employerId: string): Promise<{ endorse: number; change: number; mine: Verdict | null; comment: string | null }> {
  if (!(await writersAreDemo())) return { endorse: 0, change: 0, mine: null, comment: null };
  const r = demoStore().reviews.get(`${prId}|${employerId}`);
  if (!r) return { endorse: 0, change: 0, mine: null, comment: null };
  return { endorse: r.verdict === "endorse" ? 1 : 0, change: r.verdict === "change" ? 1 : 0, mine: r.verdict, comment: r.comment };
}
