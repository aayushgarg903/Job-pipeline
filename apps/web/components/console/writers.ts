// Write side for the console. @ks/db is built in parallel; until it exports `writers`
// (or in DATA_MODE=fixture) every write is a clearly-labelled demo that saves nothing.
import type { Writers } from "@ks/contracts";

let resolved: Promise<Writers | null> | null = null;

async function load(): Promise<Writers | null> {
  if (process.env.DATA_MODE === "fixture") return null;
  try {
    // @ts-ignore -- @ks/db may not have source (or types) yet; next.config aliases it to a stub.
    const mod = (await import("@ks/db")) as { writers?: Writers } | undefined;
    if (mod?.writers && typeof mod.writers.savePlan === "function") return mod.writers;
  } catch {
    // fall through to demo mode
  }
  return null;
}

export function getWriters(): Promise<Writers | null> {
  resolved ??= load();
  return resolved;
}
