// Cookie-free Postgres client. Safe inside Next "use cache": no request APIs are touched.
// DATABASE_URL is the Supabase transaction pooler (6543) → prepare: false, tiny pool.
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Sql = postgres.Sql;

export function loadEnv(): void {
  if (!process.env.DATABASE_URL) {
    config({ path: process.env.KS_ENV ?? "../../.env", quiet: true });
  }
}

/**
 * Supabase's transaction pooler (Supavisor, 6543) stalls when postgres.js queues several
 * queries behind one socket: reproduced with 4 concurrent parameterless selects on max=1
 * (never resolve), 3 are fine; the session pooler (5432) is unaffected. So we never let
 * postgres.js queue: at most `max` queries are outstanding, the rest wait here.
 * The returned objects are still the real postgres.js Query instances, so fragments work.
 */
function limitConcurrency(sql: Sql, max: number): Sql {
  let active = 0;
  const waiters: Array<() => void> = [];
  const acquire = () => (active < max ? (active++, Promise.resolve()) : new Promise<void>((r) => waiters.push(r)));
  const release = () => {
    const next = waiters.shift();
    if (next) next();
    else active--;
  };
  const gate = <T extends object>(q: T): T => {
    const orig = (q as unknown as PromiseLike<unknown>).then.bind(q);
    let started: Promise<unknown> | null = null;
    Object.defineProperty(q, "then", {
      configurable: true,
      value: (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => {
        started ??= acquire().then(() => orig((v) => { release(); return v; }, (e) => { release(); throw e; }));
        return started.then(onOk, onErr);
      },
    });
    return q;
  };
  const isTemplate = (a: unknown) => Array.isArray(a) && "raw" in (a as object);
  return new Proxy(sql, {
    apply(target, thisArg, args) {
      const res = Reflect.apply(target as unknown as (...a: unknown[]) => unknown, thisArg, args);
      return isTemplate(args[0]) ? gate(res as object) : res;
    },
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (prop === "unsafe" && typeof v === "function") return (...a: unknown[]) => gate(v.apply(target, a) as object);
      return v;
    },
  });
}

export function createSql(url?: string, max = 3): Sql {
  loadEnv();
  const conn = url ?? process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL is not set");
  const sql = postgres(conn, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
  return limitConcurrency(sql, max);
}

export function createDb(sql: Sql) {
  return drizzle(sql, { schema });
}
export type Db = ReturnType<typeof createDb>;
