// @ks/core: the Kaushal Setu engine (Architecture §6). Pure, deterministic TypeScript.
export * from "./random";
export * from "./shrink";
export * from "./sdi";
export * from "./gap";
export * from "./trend";
export {
  HEALTH_WEIGHTS,
  THRESHOLDS,
  courseHealth,
  currencyScore,
  outcomesScore,
  relevanceScore,
  validationScore,
  type HealthInput,
  type TargetSkillDemand,
} from "./health";
export * from "./pr";
export * from "./planner";
export * from "./forecast";
export * from "./humanize";
