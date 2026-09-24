"use client";
// "Why does it say that?" Every figure opens this drawer: the underlying rows, shown as voices.
import type { EvidenceRow, Lang } from "@ks/contracts";
import type { ReactNode } from "react";
import { fill, formatDate } from "./format";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";

export interface EvidenceLabels {
  close: string;
  /** "{n} rows behind this number." */
  count: string;
  empty: string;
  loading: string;
  error: string;
  openSource: string;
  kinds: Record<EvidenceRow["kind"], string>;
}

export const EVIDENCE_LABELS_EN: EvidenceLabels = {
  close: "Close",
  count: "{n} rows behind this number.",
  empty: "We have no rows behind this figure yet. It will fill in as postings and surveys arrive.",
  loading: "Fetching the rows behind this number…",
  error: "We couldn't load the rows just now. Try again in a moment.",
  openSource: "Open source",
  kinds: {
    posting: "Job post", survey: "Employer survey", consultation: "Meeting with employers",
    udyam: "New business (Udyam)", dataset: "Dataset", cohort: "Trainee cohort",
  },
};

const KIND_ICON: Record<EvidenceRow["kind"], IconName> = {
  posting: "briefcase", survey: "clipboard", consultation: "handshake", udyam: "factory", dataset: "database", cohort: "student",
};
/** Kinds whose `detail` is someone's own words and gets set as a quote. */
const VOICE_KINDS = new Set<EvidenceRow["kind"]>(["posting", "survey", "consultation"]);

export interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One human sentence above the rows: "14 employers in Nashik told us solar PV is a must-have." */
  intro?: ReactNode;
  rows: EvidenceRow[] | null;
  loading?: boolean;
  error?: boolean;
  lang?: Lang;
  labels?: Partial<EvidenceLabels>;
}

export function EvidenceDrawer({ open, onClose, title, intro, rows, loading, error, lang = "en", labels }: EvidenceDrawerProps) {
  const L = { ...EVIDENCE_LABELS_EN, ...labels, kinds: { ...EVIDENCE_LABELS_EN.kinds, ...labels?.kinds } };
  return (
    <Sheet open={open} onClose={onClose} title={title} description={intro} side="right" closeLabel={L.close}>
      {loading ? (
        <p role="status">{L.loading}</p>
      ) : error ? (
        <p role="alert">{L.error}</p>
      ) : !rows || rows.length === 0 ? (
        <p>{L.empty}</p>
      ) : (
        <>
          <p className="ks-voices__count">{fill(L.count, { n: rows.length })}</p>
          <ol className="ks-voices">
            {rows.map((r, i) => (
              <li key={`${r.kind}-${i}`}>
                <figure className="ks-voice">
                  <span className="ks-voice__kind">
                    <Icon name={KIND_ICON[r.kind]} size={16} />
                    {L.kinds[r.kind]}
                  </span>
                  <p className="ks-voice__title">{r.title}</p>
                  {r.detail ? (
                    VOICE_KINDS.has(r.kind) ? (
                      <blockquote className="ks-voice__quote" cite={r.url ?? undefined}>
                        <p>{r.detail}</p>
                      </blockquote>
                    ) : (
                      <p className="ks-voice__detail">{r.detail}</p>
                    )
                  ) : null}
                  <figcaption className="ks-voice__cite">
                    <span>{r.source}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={r.date}>{formatDate(r.date, lang)}</time>
                    {r.url ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <a href={r.url} target="_blank" rel="noopener noreferrer">
                          {L.openSource}
                          <span className="sr-only">: {r.title}</span>
                        </a>
                      </>
                    ) : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </>
      )}
    </Sheet>
  );
}
