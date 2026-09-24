// How fresh is each source? A strip of small stock tags on the table. Server-safe.
// `ok` comes from the reader (it knows the SLA); we never call Date.now() here.
import type { Lang, SourceHealth } from "@ks/contracts";
import { formatDateTime } from "./format";

export interface FreshnessLabels {
  title: string;
  fresh: string;
  lapsed: string;
  never: string;
}

export const FRESHNESS_LABELS_EN: FreshnessLabels = { title: "Data freshness", fresh: "Up to date", lapsed: "Lapsed", never: "Not fetched yet" };

export interface FreshnessStripProps {
  sources: Array<Pick<SourceHealth, "id" | "name" | "lastFetchAt" | "ok">>;
  lang?: Lang;
  labels?: Partial<FreshnessLabels>;
}

export function FreshnessStrip({ sources, lang = "en", labels }: FreshnessStripProps) {
  const L = { ...FRESHNESS_LABELS_EN, ...labels };
  return (
    <section aria-label={L.title}>
      <ul className="ks-fresh">
        <li className="ks-fresh__label" aria-hidden="true">{L.title}:</li>
        {sources.map((s) => (
          <li key={s.id} className="ks-fresh__item" data-ok={s.ok ? "true" : "false"}>
            <span className="ks-fresh__state" data-ok={s.ok ? "true" : "false"}>
              {s.ok ? (
                <>
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">{L.fresh}: </span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">! </span>
                  {L.lapsed.toUpperCase()}
                </>
              )}
            </span>
            <span>{s.name}</span>
            <span className="ks-fresh__when">
              {s.lastFetchAt ? <time dateTime={s.lastFetchAt}>{formatDateTime(s.lastFetchAt, lang)}</time> : L.never}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
