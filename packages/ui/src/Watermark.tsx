// Watermarks are honesty marks. The visual is aria-hidden; the meaning is always in text.
import clsx from "clsx";

export type WatermarkKind = "specimen" | "lapsed";

export interface WatermarkProps {
  kind: WatermarkKind;
  /** Visible diagonal word, e.g. "SPECIMEN" / "नमुना". */
  word?: string;
  /** Screen-reader text. Pass null when the same text is already visible nearby (e.g. a card's provenance line). */
  srText?: string | null;
  className?: string;
}

const DEFAULT_WORD: Record<WatermarkKind, string> = { specimen: "Specimen", lapsed: "Lapsed" };
const DEFAULT_SR: Record<WatermarkKind, string> = {
  specimen: "Specimen: this is demo data, not real figures.",
  lapsed: "Lapsed: this data is older than it should be.",
};

export function Watermark({ kind, word, srText, className }: WatermarkProps) {
  const sr = srText === undefined ? DEFAULT_SR[kind] : srText;
  return (
    <>
      <span className={clsx("ks-watermark", `ks-watermark--${kind}`, className)} aria-hidden="true">
        <span className="ks-watermark__word">{word ?? DEFAULT_WORD[kind]}</span>
      </span>
      {sr ? <span className="sr-only">{sr}</span> : null}
    </>
  );
}

/** The inline text equivalent used in provenance lines and captions. */
export function WatermarkText({ kind, children }: { kind: WatermarkKind; children: string }) {
  return (
    <span className="ks-watermark-inline" data-kind={kind}>
      <span aria-hidden="true">{kind === "lapsed" ? "!" : "◇"}</span>
      {children}
    </span>
  );
}
