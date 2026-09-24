// Engine selection. Default: the @ks/core adapter (./core.ts). KS_ENGINE=local selects the
// original local stand-in (./cells.ts, ./health.ts), kept as a fallback and for comparisons.
import { computeCells } from "./cells";
import { coreEngine } from "./core";
import { computeCourseHealth } from "./health";
import type { Engine } from "./types";

export const localEngine: Engine = { computeCells, computeCourseHealth };
export { coreEngine };
export const engineName = (process.env.KS_ENGINE ?? "core").toLowerCase() === "local" ? "local" : "core";
export const engine: Engine = engineName === "local" ? localEngine : coreEngine;
export type * from "./types";
