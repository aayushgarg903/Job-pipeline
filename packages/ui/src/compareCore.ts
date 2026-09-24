// Server-safe Compare helpers and types. A server page can parse ?table= with these
// (e.g. to prefetch cards for a shared link) without touching client code.

export interface CompareField {
  key: string;
  label: string;
  /** Raw value used for difference detection. */
  value: string | number | null;
  /** Formatted display text; defaults to String(value). */
  display?: string;
}

export interface CompareItem {
  /** "course:123" */
  ref: string;
  name: string;
  code?: string;
  variant?: string;
  href?: string;
  fields: CompareField[];
}

export const TABLE_PARAM = "table";
export const TABLE_MAX = 4;

/** "course:12,course:34" -> ["course:12","course:34"]; drops junk and duplicates, caps at max. */
export function parseTable(raw: string | string[] | null | undefined, max = TABLE_MAX): string[] {
  const s = Array.isArray(raw) ? raw.join(",") : raw;
  if (!s) return [];
  const out: string[] = [];
  for (const part of s.split(",")) {
    const ref = part.trim();
    if (/^[a-z]+:[\w.-]+$/i.test(ref) && !out.includes(ref)) out.push(ref);
    if (out.length >= max) break;
  }
  return out;
}

/** Numbers differ when their spread exceeds `threshold` of the largest; strings when not all equal. */
export function fieldDiffers(values: Array<CompareField["value"]>, threshold = 0.15): boolean {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length < 2) return false;
  if (present.every((v) => typeof v === "number")) {
    const nums = present as number[];
    const max = Math.max(...nums.map(Math.abs));
    if (max === 0) return false;
    return (Math.max(...nums) - Math.min(...nums)) / max > threshold;
  }
  const first = String(present[0]);
  return present.some((v) => String(v) !== first);
}
