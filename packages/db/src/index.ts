// @ks/db: module-scoped pool (max 3 on the 6543 transaction pooler, prepare: false).
// postgres() connects lazily, so importing this module never opens a socket by itself.
import { createDb, createSql, loadEnv, type Sql } from "./client";
import { createReaders } from "./readers";
import { createWriters } from "./writers";

loadEnv();
// Never throw at import time (e.g. during a web build without DB env); queries fail loudly instead.
export const sql: Sql = createSql(process.env.DATABASE_URL ?? "postgres://DATABASE_URL-not-set@127.0.0.1:1/none", 3);
export const db = createDb(sql);
export const readers = createReaders(sql);
export const writers = createWriters(sql);

export { createDb, createReaders, createSql, createWriters };
export type { Db, Sql } from "./client";
export * as schema from "./schema";
