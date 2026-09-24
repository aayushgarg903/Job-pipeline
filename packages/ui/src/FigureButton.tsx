"use client";
// A card's key figure. It is always a button: no number is a dead end.
import type { EvidenceRow, Lang } from "@ks/contracts";
import { useState } from "react";
import { EvidenceDrawer, type EvidenceLabels } from "./EvidenceDrawer";

export interface FigureDelta {
  text: string;
  dir: "up" | "down" | "flat";
  /** When "up" is bad news (e.g. a rising gap), colour follows meaning, not direction. */
  upIsBad?: boolean;
}

export interface FigureButtonProps {
  label: string;
  value: string;
  delta?: FigureDelta;
  /** Drawer title; defaults to the label. */
  evidenceTitle?: string;
  evidenceIntro?: string;
  evidence?: EvidenceRow[];
  /** Server Action or async fn. Called once, on first open. */
  loadEvidence?: () => Promise<EvidenceRow[]>;
  /** Screen-reader hint: "Show where {label} comes from". */
  whyLabel?: string;
  lang?: Lang;
  labels?: Partial<EvidenceLabels>;
  className?: string;
}

const DIR_GLYPH = { up: "▲", down: "▼", flat: "=" } as const;

export function FigureButton({
  label, value, delta, evidenceTitle, evidenceIntro, evidence, loadEvidence, whyLabel = "Show where this number comes from", lang, labels, className,
}: FigureButtonProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EvidenceRow[] | null>(evidence ?? null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function openDrawer() {
    setOpen(true);
    if (rows || !loadEvidence) return;
    setState("loading");
    try {
      setRows(await loadEvidence());
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button type="button" className={className ?? "ks-card__figure"} onClick={openDrawer} aria-haspopup="dialog">
        <span className="ks-card__figure-label">{label}</span>
        <span className="ks-card__figure-value">{value}</span>
        {delta ? (
          <span className="ks-card__figure-delta" data-dir={delta.dir} data-bad={delta.upIsBad ? "true" : undefined}>
            <span aria-hidden="true">{DIR_GLYPH[delta.dir]} </span>
            {delta.text}
          </span>
        ) : null}
        <span className="sr-only">. {whyLabel}</span>
      </button>
      <EvidenceDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={evidenceTitle ?? `${label} ${value}`}
        intro={evidenceIntro}
        rows={rows}
        loading={state === "loading"}
        error={state === "error"}
        lang={lang}
        labels={labels}
      />
    </>
  );
}
