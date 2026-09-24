// Checked-in reference data (packages/db/data/*.json), readable by other packages via "@ks/db/refdata".
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

export function readRefData<T>(file: string): T | null {
  const p = join(DATA_DIR, file);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
}
