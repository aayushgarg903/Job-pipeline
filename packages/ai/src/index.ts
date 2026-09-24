// @ks/ai: implements the Extractor and Embedder ports from @ks/contracts on Gemini.
import type { ExtractedPosting, Extractor } from "@ks/contracts";
import { parseCandidateSkills } from "./candidate";
import { createRouter, type LlmDeps, type ModelFactory, type ModelRouter, type RouterOptions } from "./client";
import { extractPosting, extractPostings, type BatchResult, type ExtractInput } from "./extract";
import { narrate } from "./narrate";

export interface ExtractorOptions extends RouterOptions {
  router?: ModelRouter;
  modelFactory?: ModelFactory; // inject a mock model in tests
}

export interface KsExtractor extends Extractor {
  extractPostings(items: ExtractInput[], opts?: { concurrency?: number }): Promise<Array<BatchResult<ExtractedPosting>>>;
  readonly router: ModelRouter;
}

/** Gemini-backed Extractor. Model chain from KS_MODEL / KS_MODEL_FALLBACKS unless given. */
export function createExtractor(opts: ExtractorOptions = {}): KsExtractor {
  const router = opts.router ?? createRouter(opts);
  const deps: LlmDeps = { router, modelFactory: opts.modelFactory };
  return {
    router,
    extractPosting: (input) => extractPosting(deps, input),
    extractPostings: (items, o) => extractPostings(deps, items, o),
    parseCandidateSkills: (input) => parseCandidateSkills(deps, input),
    narrate: (input) => narrate(deps, input),
  };
}

export { createEmbedder, EMBED_DIMS, EMBED_MODELS, fitDims, type EmbedderOptions, type EmbedderWithStats } from "./embed";
export { templateNarrate, LOW_SIGNAL_POSTINGS, type NarrateKind, type PrRationaleFacts, type CompareFacts, type PlanSummaryFacts, type CandidatePathFacts } from "./templates";
export { narrateDetailed, type NarrateOutcome } from "./narrate";
export { extractPostingDetailed, postProcess, extractionSchema, type ExtractInput, type BatchResult, type VerifyStats } from "./extract";
export { lexicalCandidateSkills, type CandidateInput, type CandidateSkill } from "./candidate";
export { createRouter, createLimiter, classifyError, modelChainFromEnv, AllModelsFailedError, DEFAULT_MODEL, DEFAULT_FALLBACKS, type ModelRouter, type RouterOptions, type Attempt } from "./client";
export { locateEvidence, negationCue, suspiciousSentences } from "./evidence";
export { ungroundedNumbers, checkProse, marketingWords } from "./grounding";
export type { Extractor, Embedder, ExtractedPosting, ExtractedSkill } from "@ks/contracts";
