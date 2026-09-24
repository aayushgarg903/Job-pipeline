// Cookie-free Postgres client. Safe inside Next "use cache": no request APIs are touched.
// DATABASE_URL is the Supabase transaction pooler (6543) → prepare: false, tiny pool.
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Sql = postgres.Sql;

export function loadEnv(): void {
  if (!process.env.DATABASE_URL) {
    config({ path: process.env.KS_ENV ?? "/home/faith/stuff/SIH/Job-pipeline/.env", quiet: true });
  }
}

export function createSql(url?: string, max = 3): Sql {
  loadEnv();
  const conn = url ?? process.env.DATABASE_URL;
  if (!conn) throw new Error("DATABASE_URL is not set");
  return postgres(conn, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
}

export function createDb(sql: Sql) {
  return drizzle(sql, { schema });
}
export type Db = ReturnType<typeof createDb>;
