// Embedder: gemini-embedding-2 at 768 dimensions, batched, cached in memory by
// content hash.
//
// Dimensions: @ai-sdk/google 4.0.79 forwards `providerOptions.google.outputDimensionality`
// to the API (see googleEmbeddingModelOptions in its index.d.ts), so we ask for 768
// directly. If a model ever returns more than 768 values anyway, we keep the first
// 768 (gemini-embedding models are Matryoshka-trained, so a prefix is a valid
// lower-dimensional embedding). Either way the vector is L2-normalised, because the
// API only normalises the full 3072-d output and pgvector cosine/inner-product
// search assumes unit vectors.
import type { Embedder } from "@ks/contracts";
import { embedMany } from "ai";
import { createHash } from "node:crypto";
import { createRouter, googleProvider, type ModelRouter } from "./client";

export const EMBED_DIMS = 768;
export const EMBED_MODELS = ["gemini-embedding-2", "gemini-embedding-001"];
const BATCH = 100; // Gemini batchEmbedContents limit

export type EmbedBatchFn = (modelId: string, values: string[], dims: number, signal: AbortSignal) => Promise<number[][]>;

const googleEmbedBatch: EmbedBatchFn = async (modelId, values, dims, signal) => {
  const { embeddings } = await embedMany({
    model: googleProvider().embeddingModel(modelId),
    values,
    maxRetries: 0,
    abortSignal: signal,
    providerOptions: { google: { outputDimensionality: dims } },
  });
  return embeddings;
};

/** First `dims` values, L2-normalised. Throws if the vector is too short. */
export function fitDims(v: number[], dims: number): number[] {
  if (v.length < dims) throw new Error(`embedding has ${v.length} dims, need ${dims}`);
  const head = v.length === dims ? v : v.slice(0, dims);
  const norm = Math.sqrt(head.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? head.map((x) => x / norm) : head;
}

export const contentHash = (text: string) => createHash("sha256").update(text).digest("hex");

export interface EmbedderOptions {
  router?: ModelRouter;
  dims?: number;
  embedBatch?: EmbedBatchFn;
}

export interface EmbedderWithStats extends Embedder {
  stats(): { cached: number; apiBatches: number; truncatedLocally: number; lastModel: string | null };
}

export function createEmbedder(opts: EmbedderOptions = {}): EmbedderWithStats {
  const dims = opts.dims ?? EMBED_DIMS;
  const router = opts.router ?? createRouter({ models: EMBED_MODELS, concurrency: 2 });
  const batchFn = opts.embedBatch ?? googleEmbedBatch;
  const cache = new Map<string, number[]>();
  let apiBatches = 0, truncatedLocally = 0;
  let lastModel: string | null = null;

  async function embed(texts: string[]): Promise<number[][]> {
    const keys = texts.map(contentHash);
    const missing = new Map<string, string>(); // hash -> text, deduplicated
    keys.forEach((k, i) => { if (!cache.has(k) && !missing.has(k)) missing.set(k, texts[i]!); });
    const todo = [...missing];
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      const { value, model } = await router.run((modelId, signal) => batchFn(modelId, chunk.map(([, t]) => t), dims, signal));
      apiBatches++;
      lastModel = model;
      if (value.length !== chunk.length) throw new Error(`embedder returned ${value.length} vectors for ${chunk.length} texts`);
      value.forEach((v, j) => {
        if (v.length > dims) truncatedLocally++;
        cache.set(chunk[j]![0], fitDims(v, dims));
      });
    }
    return keys.map((k) => cache.get(k)!);
  }

  return { embed, stats: () => ({ cached: cache.size, apiBatches, truncatedLocally, lastModel }) };
}
