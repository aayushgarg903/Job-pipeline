// The one way pages get data. DATA_MODE=fixture -> demo fixtures; otherwise @ks/db's readers.
// @ks/db is built in parallel: if it is missing or doesn't export `readers` yet, we warn once
// and fall back to fixtures so the app always renders.
//
// Readers take only primitives, so product pages can wrap calls in "use cache" scopes.
// Never call cookies()/headers() in here.
import type { Readers } from "@ks/contracts";
import { fixtureReaders } from "./fixtures";

let resolved: Promise<Readers> | null = null;
let warned = false;

function warn(msg: string) {
  if (warned) return;
  warned = true;
  console.warn(`[readers] ${msg} Falling back to fixture data (isDemo = true).`);
}

async function load(): Promise<Readers> {
  if (process.env.DATA_MODE === "fixture") return fixtureReaders;
  try {
    // next.config.ts aliases this to lib/db-missing.ts until packages/db/src/index.ts exists.
    // @ts-ignore -- @ks/db may not have source (or types) yet; resolved at build time.
    const mod = (await import("@ks/db")) as { readers?: Readers } | undefined;
    if (mod?.readers && typeof mod.readers.stateOverview === "function") return mod.readers;
    warn("@ks/db does not export `readers` yet.");
  } catch (err) {
    warn(`Could not load @ks/db (${err instanceof Error ? err.message : String(err)}).`);
  }
  return fixtureReaders;
}

export function getReaders(): Promise<Readers> {
  resolved ??= load();
  return resolved;
}

export const isFixtureMode = () => process.env.DATA_MODE === "fixture";
