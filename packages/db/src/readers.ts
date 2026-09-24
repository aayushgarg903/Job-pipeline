// Readers: the read side of the contract. Every function takes primitives only and uses a
// cookie-free connection, so the web app can call them inside Next "use cache".
import type { Readers } from "@ks/contracts";
import type { Sql } from "./client";
import { courseReaders } from "./readers/courses";
import { demandReaders } from "./readers/demand";
import { miscReaders } from "./readers/misc";

export function createReaders(sql: Sql): Readers {
  return { ...demandReaders(sql), ...courseReaders(sql), ...miscReaders(sql) };
}
