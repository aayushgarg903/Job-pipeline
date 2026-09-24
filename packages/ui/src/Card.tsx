// The Card: one anatomy for everything (Design.md §3). Server-safe; interactive parts
// (figure -> EvidenceDrawer, Place on table) are small client islands.
//
//  CODE                                   FIGURE ▲ delta
//                 N A M E   I N   S M A L L   C A P S
//                        title line, italic
//            ▲ VERDICT   one-line numbers
//      A human sentence about people, not percentages.
//  ─────────────────────────────────────────────────────
//  412 postings · 18 employers                as of SEP 26
import clsx from "clsx";
import type { Lang, Provenance } from "@ks/contracts";
import type { ReactNode } from "react";
import { Badge, type Tone } from "./Badge";
import type { CompareItem } from "./compareCore";
import type { EvidenceLabels } from "./EvidenceDrawer";
import { FigureButton, type FigureButtonProps } from "./FigureButton";
import { fill, formatAsOf, formatNumber } from "./format";
import { Seal } from "./Seal";
import { TableToggle } from "./TableToggle";
import { UiLink } from "./UiLink";
import { Watermark, WatermarkText } from "./Watermark";

export type CardVariant = "district" | "skill" | "course" | "employer" | "candidate" | "plan" | "pr";

export type CardFigure = Omit<FigureButtonProps, "lang" | "labels" | "className">;

export interface CardVerdict {
  tone: Tone;
  /** SHORTAGE · HEALTHY · REVISE ... */
  word: string;
  glyph?: string;
  /** "1,240 demand · 310 supply (4.0×)" */
  text?: string;
}

export interface CardLabels {
  asOf: string; // "as of"
  specimen: string; // "SPECIMEN · demo data"
  specimenWord: string; // watermark word
  lapsed: string; // "LAPSED · older than it should be"
  lapsedWord: string;
  endorsed: string; // "Endorsed by {n} local employers"
  placeOnTable: string;
  onTable: string;
  open: string;
  why: string;
}

export const CARD_LABELS_EN: CardLabels = {
  asOf: "as of",
  specimen: "Specimen · demo data",
  specimenWord: "Specimen",
  lapsed: "Lapsed · older than it should be",
  lapsedWord: "Lapsed",
  endorsed: "Endorsed by {n} local employers",
  placeOnTable: "Place on table",
  onTable: "On table",
  open: "Open card",
  why: "Show where this number comes from",
};

export interface CardProps {
  variant: CardVariant;
  /** Top-left: LGD code, NCO / QP code, anonymised id... */
  code: string;
  /** The name, set in tracked small caps. */
  name: string;
  title?: string;
  figure?: CardFigure;
  verdict?: CardVerdict;
  /** The human sentence: people, not percentages. */
  human?: ReactNode;
  provenance: Provenance;
  /** Employer endorsements: shows the pressed seal. */
  endorsements?: number;
  /** Detail page. The name becomes a link. */
  href?: string;
  /** Adds "Place on table". ref is "kind:id", e.g. "course:123". */
  compare?: Omit<CompareItem, "name" | "code" | "variant" | "href"> & { name?: string };
  /** Force the selected-for-compare look (galleries, static renders). */
  selected?: boolean;
  expanded?: boolean;
  /** Content language; drives Devanagari typography and number formats. */
  lang?: Lang;
  labels?: Partial<CardLabels>;
  evidenceLabels?: Partial<EvidenceLabels>;
  /** Extra content under the verdict (e.g. a mini chart on expanded cards). */
  children?: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4;
  className?: string;
}

export function provenanceSources(p: Provenance, lang: Lang = "en"): string {
  return p.sources.map((s) => `${formatNumber(s.n, lang)} ${s.label}`).join(" · ");
}

export function Card(props: CardProps) {
  const {
    variant, code, name, title, figure, verdict, human, provenance, endorsements, href, compare, selected, expanded,
    lang = "en", labels, evidenceLabels, children, headingLevel = 3, className,
  } = props;
  const L = { ...CARD_LABELS_EN, ...labels };
  const H = `h${headingLevel}` as const;
  const item: CompareItem | null = compare
    ? { ref: compare.ref, name: compare.name ?? name, code, variant, href, fields: compare.fields }
    : null;

  return (
    <article
      className={clsx("ks-card", `ks-card--${variant}`, expanded && "ks-card--expanded", className)}
      data-selected={selected ? "true" : undefined}
      lang={lang === "mr" ? "mr" : undefined}
    >
      {provenance.isDemo ? <Watermark kind="specimen" word={L.specimenWord} srText={null} /> : null}
      {provenance.lapsed ? <Watermark kind="lapsed" word={L.lapsedWord} srText={null} /> : null}

      <div className="ks-card__head">
        <span className="ks-card__code">{code}</span>
        {figure ? <FigureButton {...figure} whyLabel={figure.whyLabel ?? L.why} lang={lang} labels={evidenceLabels} /> : null}
      </div>

      <div className="ks-card__body">
        <H className="ks-card__name letterpress">{href ? <UiLink href={href}>{name}</UiLink> : name}</H>
        {title ? <p className="ks-card__title">{title}</p> : null}
        {verdict ? (
          <p className="ks-card__verdict">
            <Badge tone={verdict.tone} glyph={verdict.glyph}>
              {verdict.word}
            </Badge>
            {verdict.text ? <span className="ks-card__verdict-text">{verdict.text}</span> : null}
          </p>
        ) : null}
        {human ? <p className="ks-card__human">{human}</p> : null}
        {children}
      </div>

      {typeof endorsements === "number" && endorsements > 0 ? (
        <Seal className="ks-card__seal" count={endorsements} label={fill(L.endorsed, { n: endorsements })} size={44} />
      ) : null}

      <footer className="ks-card__prov">
        <span className="ks-card__prov-sources">{provenanceSources(provenance, lang)}</span>
        <span className="ks-card__prov-marks">
          {provenance.isDemo ? <WatermarkText kind="specimen">{L.specimen}</WatermarkText> : null}
          {provenance.lapsed ? <WatermarkText kind="lapsed">{L.lapsed}</WatermarkText> : null}
          {typeof endorsements === "number" && endorsements > 0 ? (
            <span className="sr-only">{fill(L.endorsed, { n: endorsements })}</span>
          ) : null}
          <time className="ks-card__prov-asof" dateTime={provenance.asOf}>
            {L.asOf} {formatAsOf(provenance.asOf, lang)}
          </time>
        </span>
      </footer>

      {item || href ? (
        <div className="ks-card__actions">
          {item ? <TableToggle item={item} placeLabel={L.placeOnTable} onTableLabel={L.onTable} pressed={selected} /> : <span />}
          {href ? (
            <UiLink href={href} className="ks-card__open" aria-hidden="true" tabIndex={-1}>
              {L.open} →
            </UiLink>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Persona / gateway card: the whole card is one link (used by the landing Card Case). */
export interface GatewayCardProps {
  variant: CardVariant;
  code: string;
  name: string;
  title?: string;
  human?: ReactNode;
  href: string;
  cta: string;
  lang?: Lang;
  headingLevel?: 2 | 3;
}

export function GatewayCard({ variant, code, name, title, human, href, cta, lang = "en", headingLevel = 2 }: GatewayCardProps) {
  const H = `h${headingLevel}` as const;
  return (
    <article className={clsx("ks-card", `ks-card--${variant}`, "ks-card--link")} lang={lang === "mr" ? "mr" : undefined}>
      <div className="ks-card__head">
        <span className="ks-card__code">{code}</span>
      </div>
      <div className="ks-card__body">
        <H className="ks-card__name letterpress">
          <UiLink href={href} className="ks-card__stretch" data-roving-item="">
            {name}
          </UiLink>
        </H>
        {title ? <p className="ks-card__title">{title}</p> : null}
        {human ? <p className="ks-card__human">{human}</p> : null}
      </div>
      <footer className="ks-card__prov" aria-hidden="true">
        <span />
        <span className="ks-card__prov-asof">{cta} →</span>
      </footer>
    </article>
  );
}
