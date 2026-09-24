// Posting dedup: exact description_hash, then word-shingle Jaccard >= 0.8 among postings from the
// same employer (or same title) within 14 days. At our volume (thousands) exact Jaccard over a
// blocked candidate set is cheaper and more accurate than MinHash.
import { normalizeText, sha256 } from "./util";

export const JACCARD_THRESHOLD = 0.8;
const WINDOW_MS = 14 * 24 * 3600_000;

export const descriptionHash = (description: string) =>
  sha256(normalizeText(description).replace(/[.+#]/g, " ").replace(/\s+/g, " ").trim());

export function shingles(text: string, k = 4): Set<string> {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  if (words.length <= k) {
    if (words.length) out.add(words.join(" "));
    return out;
  }
  for (let i = 0; i + k <= words.length; i++) out.add(words.slice(i, i + k).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface DedupItem { id: string; employer: string; title: string; description: string; postedAt: Date }
interface Indexed extends DedupItem { hash: string; sh: Set<string>; emp: string; ttl: string }

/** Incremental deduper: add() returns the canonical id when the item duplicates an earlier one. */
export class Deduper {
  private byHash = new Map<string, string>();
  private items: Indexed[] = [];

  add(item: DedupItem): { canonicalId: string | null; reason: "hash" | "jaccard" | null; similarity: number } {
    const hash = descriptionHash(item.description);
    const exact = this.byHash.get(hash);
    const idx: Indexed = { ...item, hash, sh: shingles(item.description), emp: normalizeText(item.employer), ttl: normalizeText(item.title) };
    if (exact === item.id || this.items.some((o) => o.id === item.id)) {
      return { canonicalId: null, reason: null, similarity: 0 }; // re-normalising a known posting
    }
    if (exact) {
      return { canonicalId: exact, reason: "hash", similarity: 1 };
    }
    let best: { id: string; sim: number } | null = null;
    for (const o of this.items) {
      if (Math.abs(o.postedAt.getTime() - item.postedAt.getTime()) > WINDOW_MS) continue;
      if (o.emp !== idx.emp && o.ttl !== idx.ttl) continue;
      const sim = jaccard(o.sh, idx.sh);
      if (sim >= JACCARD_THRESHOLD && (!best || sim > best.sim)) best = { id: o.id, sim };
    }
    this.byHash.set(hash, best?.id ?? item.id);
    if (best) return { canonicalId: best.id, reason: "jaccard", similarity: best.sim };
    this.items.push(idx);
    return { canonicalId: null, reason: null, similarity: 0 };
  }
}
