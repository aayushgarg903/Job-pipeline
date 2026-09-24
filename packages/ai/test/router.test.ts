import { describe, expect, it } from "vitest";
import { AllModelsFailedError, backoffMs, classifyError, createLimiter, createRouter, modelChainFromEnv } from "../src/client";
import { createExtractor } from "../src/index";
import { apiError, scriptedModels, testRouter } from "./helpers";

describe("classifyError", () => {
  it("retries 429 and 503, moves on for 404, stops on 401", () => {
    expect(classifyError(apiError(503))).toBe("retry");
    expect(classifyError(apiError(429))).toBe("retry");
    expect(classifyError(apiError(429, "Quota exceeded for requests per day"))).toBe("next");
    expect(classifyError(apiError(429, "You exceeded your current quota, please check your plan"))).toBe("next");
    expect(classifyError(apiError(404, "model not found"))).toBe("next");
    expect(classifyError(apiError(401))).toBe("fatal");
    expect(classifyError(new Error("The model is overloaded due to high demand"))).toBe("retry");
  });
});

describe("backoffMs", () => {
  it("grows exponentially, is capped, and jitters within [50%, 100%]", () => {
    expect(backoffMs(0, 1000, 10_000, () => 1)).toBe(1000);
    expect(backoffMs(0, 1000, 10_000, () => 0)).toBe(500);
    expect(backoffMs(3, 1000, 10_000, () => 1)).toBe(8000);
    expect(backoffMs(10, 1000, 10_000, () => 1)).toBe(10_000);
  });
});

describe("createRouter", () => {
  it("retries the same model on 503 and records the model that answered", async () => {
    const router = testRouter(["a", "b"], 2);
    let n = 0;
    const res = await router.run(async (m) => { if (++n < 3) throw apiError(503); return `hi from ${m}`; });
    expect(res.value).toBe("hi from a");
    expect(res.model).toBe("a");
    expect(res.attempts.map((a) => [a.model, a.ok, a.status])).toEqual([["a", false, 503], ["a", false, 503], ["a", true, 200]]);
  });

  it("falls back down the chain after retries run out", async () => {
    const router = testRouter(["a", "b", "c"], 1);
    const res = await router.run(async (m) => { if (m !== "c") throw apiError(503); return m; });
    expect(res.model).toBe("c");
    expect(res.attempts.map((a) => a.model)).toEqual(["a", "a", "b", "b", "c"]);
    expect(router.attempts()).toHaveLength(5);
  });

  it("skips a missing model without retrying it", async () => {
    const router = testRouter(["gone", "ok"], 3);
    const res = await router.run(async (m) => { if (m === "gone") throw apiError(404); return m; });
    expect(res.attempts.map((a) => a.model)).toEqual(["gone", "ok"]);
  });

  it("stops immediately on a bad API key", async () => {
    const router = testRouter(["a", "b"], 2);
    await expect(router.run(async () => { throw apiError(401); })).rejects.toMatchObject({ statusCode: 401 });
    expect(router.attempts()).toHaveLength(1);
  });

  it("throws AllModelsFailedError with every attempt when the chain is exhausted", async () => {
    const router = testRouter(["a", "b"], 1);
    const err = await router.run(async () => { throw apiError(503); }).catch((e) => e);
    expect(err).toBeInstanceOf(AllModelsFailedError);
    expect((err as AllModelsFailedError).attempts).toHaveLength(4);
  });

  it("times out a hung call and moves to the next model", async () => {
    const router = createRouter({ models: ["slow", "fast"], retriesPerModel: 2, timeoutMs: 30, sleep: async () => {} });
    const res = await router.run((m, signal) => new Promise<string>((resolve, reject) => {
      if (m === "fast") return resolve(m);
      signal.addEventListener("abort", () => reject(signal.reason));
    }));
    expect(res.model).toBe("fast");
    expect(res.attempts[0]).toMatchObject({ model: "slow", ok: false });
  });

  it("uses exponential backoff between retries", async () => {
    const waits: number[] = [];
    const router = createRouter({ models: ["a"], retriesPerModel: 3, baseDelayMs: 100, maxDelayMs: 10_000, breakerThreshold: 10, sleep: async (ms) => { waits.push(ms); } });
    await router.run(async () => { throw apiError(503); }).catch(() => {});
    expect(waits).toHaveLength(3);
    expect(waits[0]).toBeGreaterThanOrEqual(50);
    expect(waits[0]).toBeLessThanOrEqual(100);
    expect(waits[2]).toBeGreaterThanOrEqual(200);
    expect(waits[2]).toBeLessThanOrEqual(400);
  });
});

describe("circuit breaker", () => {
  const quota = () => apiError(429, "You exceeded your current quota, please check your plan and billing details.");

  it("skips a model with an exhausted quota on every later call", async () => {
    const router = testRouter(["q", "ok"], 2);
    const fn = async (m: string) => { if (m === "q") throw quota(); return m; };
    const first = await router.run(fn);
    expect(first.attempts.map((a) => a.model)).toEqual(["q", "ok"]); // no retry on quota
    const second = await router.run(fn);
    expect(second.attempts.map((a) => a.model)).toEqual(["ok"]);
    expect(router.openCircuits()).toMatchObject([{ model: "q", reason: "quota exhausted" }]);
  });

  it("trips after consecutive 503s and reopens after the cooldown", async () => {
    let t = 0;
    const router = createRouter({ models: ["busy", "ok"], retriesPerModel: 1, breakerThreshold: 3, breakerCooldownMs: 1_000, sleep: async () => {}, now: () => t });
    const fn = async (m: string) => { if (m === "busy") throw apiError(503); return m; };
    await router.run(fn); // busy x2
    const r2 = await router.run(fn); // busy x1 more -> tripped
    expect(r2.attempts.map((a) => a.model)).toEqual(["busy", "ok"]);
    const r3 = await router.run(fn);
    expect(r3.attempts.map((a) => a.model)).toEqual(["ok"]);
    t = 1_001;
    const r4 = await router.run(fn);
    expect(r4.attempts[0]!.model).toBe("busy"); // half-open: tried again
  });

  it("still tries the soonest-reopening model when every circuit is open", async () => {
    let t = 0;
    const router = createRouter({ models: ["a", "b"], retriesPerModel: 0, breakerThreshold: 1, breakerCooldownMs: 1_000, sleep: async () => {}, now: () => t });
    await router.run(async () => { throw apiError(503); }).catch(() => {}); // trips a (t=0) and b (t=0)
    t = 10;
    const res = await router.run(async (m) => m);
    expect(res.attempts).toHaveLength(1);
  });
});

describe("createLimiter", () => {
  it("never runs more than N tasks at once", async () => {
    const limit = createLimiter(2);
    let active = 0, peak = 0;
    const task = () => limit(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    await Promise.all(Array.from({ length: 8 }, task));
    expect(peak).toBe(2);
  });
});

describe("modelChainFromEnv", () => {
  it("defaults to gemini-3.6-flash with the documented fallbacks", () => {
    expect(modelChainFromEnv({})).toEqual(["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"]);
  });
  it("honours KS_MODEL and KS_MODEL_FALLBACKS", () => {
    expect(modelChainFromEnv({ KS_MODEL: "x", KS_MODEL_FALLBACKS: "y, z,,x" })).toEqual(["x", "y", "z"]);
    expect(modelChainFromEnv({ KS_MODEL_FALLBACKS: "" })).toEqual(["gemini-3.6-flash"]);
  });
});

describe("extractor end to end with a mocked model", () => {
  it("falls back when the primary returns 503 and stamps the fallback model id", async () => {
    const description = "Must know Fanuc controls. Docker not required.";
    const answer = {
      nco: "7223.0100", ncoConfidence: 0.9, workMode: "on_site",
      skills: [
        { text: "Fanuc controls", skillId: "fanuc", requirement: "required", proficiency: null, years: null, negated: false, evidence: "Must know Fanuc controls.", confidence: 0.9 },
        { text: "Docker", skillId: "docker", requirement: "optional", proficiency: null, years: null, negated: false, evidence: "Docker not required.", confidence: 0.8 },
      ],
    };
    const { factory, calls } = scriptedModels({ primary: [apiError(503)], backup: [answer] });
    const ex = createExtractor({ router: testRouter(["primary", "backup"], 1), modelFactory: factory });
    const out = await ex.extractPosting({
      title: "CNC Operator", description,
      skillsCatalog: [{ id: "fanuc", labelEn: "Fanuc" }, { id: "docker", labelEn: "Docker" }],
      occupations: [{ nco: "7223.0100", titleEn: "CNC operator" }],
    });
    expect(calls).toEqual(["primary", "primary", "backup"]);
    expect(out.model).toBe("backup");
    expect(out.nco).toBe("7223.0100");
    // The model missed the negation; the deterministic cue check catches it.
    expect(out.skills.find((s) => s.skillId === "docker")?.negated).toBe(true);
  });
});
