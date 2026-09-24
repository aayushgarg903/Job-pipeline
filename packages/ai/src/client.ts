// Model router: primary model + fallback chain, retry with backoff and jitter on
// 429/503, per-call timeout, a tiny concurrency limiter, and a record of which
// model actually answered. Everything network-facing in @ks/ai goes through here.
import { createGoogleGenerativeAI, type GoogleProvider } from "@ai-sdk/google";
import { generateText, Output, type LanguageModel } from "ai";
import { config as loadDotenv } from "dotenv";
import type { z } from "zod";

export const DEFAULT_MODEL = "gemini-3.6-flash";
export const DEFAULT_FALLBACKS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];
export const DEFAULT_ENV_PATH = "/home/faith/stuff/SIH/Job-pipeline/.env";

let envLoaded = false;
/** Loads secrets once from KS_ENV (or the project .env). Never overrides variables already set. */
export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  loadDotenv({ path: process.env.KS_ENV ?? DEFAULT_ENV_PATH, quiet: true, override: false });
}

/** Model chain from env: KS_MODEL (primary) and KS_MODEL_FALLBACKS (comma separated). */
export function modelChainFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const primary = env.KS_MODEL?.trim() || DEFAULT_MODEL;
  const fallbacks = env.KS_MODEL_FALLBACKS !== undefined
    ? env.KS_MODEL_FALLBACKS.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FALLBACKS;
  return [...new Set([primary, ...fallbacks])];
}

// ---------------------------------------------------------------- limiter
export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

/** Runs at most `max` tasks at once; the rest wait in FIFO order. */
export function createLimiter(max: number): Limiter {
  if (!Number.isInteger(max) || max < 1) throw new Error(`limiter size must be >= 1, got ${max}`);
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= max) return;
    const start = queue.shift();
    if (start) { active++; start(); }
  };
  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(resolve, reject).finally(() => { active--; next(); });
      });
      next();
    });
}

// ---------------------------------------------------------------- errors
export type ErrorClass = "retry" | "next" | "fatal";

/** HTTP status from an AI SDK error (APICallError, RetryError, or a wrapped cause). */
export function statusOf(err: unknown): number | null {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as { statusCode?: unknown; status?: unknown; lastError?: unknown; cause?: unknown };
    if (typeof e.statusCode === "number") return e.statusCode;
    if (typeof e.status === "number") return e.status;
    cur = e.lastError ?? e.cause;
  }
  return null;
}

/** retry: same model after backoff · next: move down the chain · fatal: stop (bad key). */
export function classifyError(err: unknown): ErrorClass {
  const status = statusOf(err);
  const name = (err as { name?: string })?.name ?? "";
  const msg = String((err as { message?: string })?.message ?? err);
  if (name === "AI_LoadAPIKeyError" || status === 401) return "fatal";
  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) {
    // An exhausted quota won't come back in a few seconds: go to the next model instead.
    if (status === 429 && isQuotaExhausted(err)) return "next";
    return "retry";
  }
  if (status === null && /\b(503|UNAVAILABLE|high demand|overloaded|RESOURCE_EXHAUSTED)\b/i.test(msg)) return "retry";
  return "next"; // 404 model gone, 400 schema quirk, timeout, unparsable output...
}

/** 429 because the key's quota is used up (as opposed to a short burst limit). */
export function isQuotaExhausted(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  return statusOf(err) === 429 && /exceeded your current quota|quota exceeded|per ?day|daily/i.test(msg);
}

function retryAfterMs(err: unknown): number | null {
  const headers = (err as { responseHeaders?: Record<string, string> })?.responseHeaders;
  const raw = headers?.["retry-after"];
  if (!raw) return null;
  const secs = Number(raw);
  return Number.isFinite(secs) ? secs * 1000 : null;
}

/** Exponential backoff with jitter: base·2^attempt, capped, scaled into [50%, 100%]. */
export function backoffMs(attempt: number, baseMs: number, capMs: number, rand: () => number = Math.random): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.round(ceiling * (0.5 + 0.5 * rand()));
}

// ---------------------------------------------------------------- router
export interface Attempt {
  model: string;
  ok: boolean;
  status: number | null;
  error?: string;
  ms: number;
}

export interface RouterOptions {
  models?: string[];
  retriesPerModel?: number; // retries on 429/503 before falling back (default 2)
  timeoutMs?: number; // per attempt (default 45s, env KS_TIMEOUT_MS)
  concurrency?: number; // in-flight requests (default 4, env KS_CONCURRENCY)
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onAttempt?: (a: Attempt) => void;
  /** Circuit breaker: after this many consecutive failures a model is skipped (default 3). */
  breakerThreshold?: number;
  breakerCooldownMs?: number; // how long a tripped model is skipped (default 30s)
  quotaCooldownMs?: number; // how long a model with an exhausted quota is skipped (default 10 min)
  now?: () => number;
}

export interface RunResult<T> { value: T; model: string; attempts: Attempt[] }

export interface ModelRouter {
  readonly models: readonly string[];
  run<T>(fn: (modelId: string, signal: AbortSignal) => Promise<T>, opts?: { models?: string[] }): Promise<RunResult<T>>;
  /** Every attempt this router has made (one attempt = one API call). */
  attempts(): readonly Attempt[];
  /** Models currently skipped by the circuit breaker, with the time they reopen. */
  openCircuits(): Array<{ model: string; until: number; reason: string }>;
}

export class AllModelsFailedError extends Error {
  constructor(readonly attempts: Attempt[], readonly lastError: unknown) {
    super(`all models failed: ${attempts.map((a) => `${a.model}:${a.status ?? a.error}`).join(", ")}`);
    this.name = "AllModelsFailedError";
  }
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const envInt = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export function createRouter(opts: RouterOptions = {}): ModelRouter {
  const models = opts.models ?? modelChainFromEnv();
  const retries = opts.retriesPerModel ?? 2;
  const timeoutMs = opts.timeoutMs ?? envInt(process.env.KS_TIMEOUT_MS, 45_000);
  const limit = createLimiter(opts.concurrency ?? envInt(process.env.KS_CONCURRENCY, 4));
  const base = opts.baseDelayMs ?? 1_000;
  const cap = opts.maxDelayMs ?? 10_000;
  const sleep = opts.sleep ?? realSleep;
  const now = opts.now ?? Date.now;
  const threshold = opts.breakerThreshold ?? 3;
  const cooldown = opts.breakerCooldownMs ?? 30_000;
  const quotaCooldown = opts.quotaCooldownMs ?? 600_000;
  const log: Attempt[] = [];
  // Shared across calls: once one request learns a model is down, the others skip it.
  const failures = new Map<string, number>();
  const open = new Map<string, { until: number; reason: string }>();

  const isOpen = (m: string) => (open.get(m)?.until ?? 0) > now();
  const trip = (m: string, ms: number, reason: string) => { open.set(m, { until: now() + ms, reason }); failures.set(m, 0); };
  const recordFailure = (m: string, err: unknown) => {
    if (isQuotaExhausted(err)) return trip(m, quotaCooldown, "quota exhausted");
    const n = (failures.get(m) ?? 0) + 1;
    failures.set(m, n);
    if (n >= threshold) trip(m, cooldown, `${n} consecutive failures`);
  };

  /** Healthy models in chain order; if every one is tripped, the one that reopens first. */
  function usable(chain: readonly string[]): string[] {
    const healthy = chain.filter((m) => !isOpen(m));
    if (healthy.length) return healthy;
    const soonest = [...chain].sort((a, b) => (open.get(a)?.until ?? 0) - (open.get(b)?.until ?? 0))[0];
    return soonest ? [soonest] : [];
  }

  async function run<T>(fn: (modelId: string, signal: AbortSignal) => Promise<T>, runOpts?: { models?: string[] }): Promise<RunResult<T>> {
    const chain = runOpts?.models ?? models;
    const mine: Attempt[] = [];
    let lastError: unknown = null;
    for (const model of usable(chain)) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const t0 = Date.now();
        try {
          // The limiter wraps a single attempt, so backoff sleeps don't hold a slot.
          const value = await limit(() => fn(model, AbortSignal.timeout(timeoutMs)));
          const a: Attempt = { model, ok: true, status: 200, ms: Date.now() - t0 };
          mine.push(a); log.push(a); if (log.length > 1000) log.splice(0, 500); opts.onAttempt?.(a);
          failures.set(model, 0);
          return { value, model, attempts: mine };
        } catch (err) {
          lastError = err;
          const cls = classifyError(err);
          const a: Attempt = {
            model, ok: false, status: statusOf(err), ms: Date.now() - t0,
            error: `${(err as Error)?.name ?? "Error"}: ${String((err as Error)?.message ?? err).slice(0, 160)}`,
          };
          mine.push(a); log.push(a); if (log.length > 1000) log.splice(0, 500); opts.onAttempt?.(a);
          if (cls === "fatal") throw err;
          recordFailure(model, err);
          if (cls === "next" || attempt === retries || isOpen(model)) break;
          const hinted = retryAfterMs(err);
          await sleep(hinted !== null ? Math.min(hinted, cap * 2) : backoffMs(attempt, base, cap));
        }
      }
    }
    throw new AllModelsFailedError(mine, lastError);
  }

  const openCircuits = () => [...open].filter(([m]) => isOpen(m)).map(([model, v]) => ({ model, ...v }));
  return { models, run, attempts: () => log, openCircuits };
}

// ---------------------------------------------------------------- provider + calls
let cachedProvider: GoogleProvider | null = null;
export function googleProvider(): GoogleProvider {
  if (cachedProvider) return cachedProvider;
  loadEnv();
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  cachedProvider = createGoogleGenerativeAI(apiKey ? { apiKey } : {});
  return cachedProvider;
}

export type ModelFactory = (modelId: string) => LanguageModel;
const defaultFactory: ModelFactory = (id) => googleProvider()(id);

/** Gemini 3 models take a thinking level; keep it low for extraction latency. */
function providerOptionsFor(modelId: string) {
  return /^gemini-3/.test(modelId) ? { google: { thinkingConfig: { thinkingLevel: "low" as const } } } : undefined;
}

export interface LlmDeps {
  router: ModelRouter;
  modelFactory?: ModelFactory;
}

export interface GenerateRequest { instructions: string; prompt: string }

/** Structured output (AI SDK 7 `Output.object`) through the router. */
export async function generateStructured<S extends z.ZodType>(
  deps: LlmDeps, req: GenerateRequest & { schema: S; name?: string },
): Promise<{ object: z.infer<S>; model: string }> {
  const factory = deps.modelFactory ?? defaultFactory;
  const { value, model } = await deps.router.run(async (modelId, signal) => {
    const res = await generateText({
      model: factory(modelId),
      instructions: req.instructions,
      prompt: req.prompt,
      output: Output.object({ schema: req.schema, name: req.name }),
      maxRetries: 0, // the router owns retries, so the attempt log is accurate
      abortSignal: signal,
      providerOptions: providerOptionsFor(modelId),
    });
    return res.output as z.infer<S>;
  });
  return { object: value, model };
}

/** Plain text through the router. */
export async function generateProse(deps: LlmDeps, req: GenerateRequest): Promise<{ text: string; model: string }> {
  const factory = deps.modelFactory ?? defaultFactory;
  const { value, model } = await deps.router.run(async (modelId, signal) => {
    const res = await generateText({
      model: factory(modelId),
      instructions: req.instructions,
      prompt: req.prompt,
      maxRetries: 0,
      abortSignal: signal,
      providerOptions: providerOptionsFor(modelId),
    });
    return res.text;
  });
  return { text: value.trim(), model };
}

/** A short random id for delimiting untrusted data blocks in prompts. */
export function nonce(): string {
  return Math.random().toString(36).slice(2, 8);
}
