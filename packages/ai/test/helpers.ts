// Test helpers: a scripted mock language model (no network) and API errors.
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { createRouter, type ModelFactory, type ModelRouter } from "../src/client";

export function apiError(statusCode: number, message = `HTTP ${statusCode}`): APICallError {
  return new APICallError({ message, url: "https://mock.test", requestBodyValues: {}, statusCode, isRetryable: statusCode >= 500 || statusCode === 429 });
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

/** One scripted step: a text reply, a JSON reply, or an error to throw. */
export type Step = string | Record<string, unknown> | Error;

/**
 * A model factory whose models answer from per-model scripts. Each call to a
 * model consumes its next step; the last step repeats. Records every call.
 */
export function scriptedModels(scripts: Record<string, Step[]>): { factory: ModelFactory; calls: string[] } {
  const calls: string[] = [];
  const cursor = new Map<string, number>();
  const factory: ModelFactory = (modelId) =>
    new MockLanguageModelV4({
      modelId,
      doGenerate: async () => {
        calls.push(modelId);
        const script = scripts[modelId] ?? [new Error(`no script for ${modelId}`)];
        const i = cursor.get(modelId) ?? 0;
        cursor.set(modelId, i + 1);
        const step = script[Math.min(i, script.length - 1)]!;
        if (step instanceof Error) throw step;
        const text = typeof step === "string" ? step : JSON.stringify(step);
        return { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "STOP" }, usage, warnings: [] };
      },
    });
  return { factory, calls };
}

/** A router with instant backoff for tests. */
export function testRouter(models: string[], retriesPerModel = 1): ModelRouter {
  return createRouter({ models, retriesPerModel, sleep: async () => {}, timeoutMs: 2_000, concurrency: 4 });
}
