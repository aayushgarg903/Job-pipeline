// SWAP POINT: replace localEngine with an adapter over @ks/core once it merges, e.g.
//   import * as core from "@ks/core";
//   export const engine: Engine = { computeCells: (i) => core.computeCells(i), computeCourseHealth: (i) => core.courseHealth(i) };
// The input/output shapes are in ./types.ts; facts.ts only talks to `engine`.
import { computeCells } from "./cells";
import { computeCourseHealth } from "./health";
import type { Engine } from "./types";

export const localEngine: Engine = { computeCells, computeCourseHealth };
export const engine: Engine = localEngine;
export type * from "./types";
