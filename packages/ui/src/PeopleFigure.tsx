// "People, not percentages": one big humane number and the sentence that explains it.
import clsx from "clsx";
import type { ReactNode } from "react";
import type { Lang } from "@ks/contracts";
import { formatNumber, humanRound, isApprox } from "./format";

export interface PeopleFigureProps {
  value: number;
  /** "people", "लोक", "seats"... */
  unit: string;
  /** The human sentence: "could be hired as solar technicians in Nashik next year." */
  sentence?: ReactNode;
  /** Round the way a person speaks and prefix "≈". Default true. */
  approx?: boolean;
  /** Screen-reader word for "≈". */
  approxLabel?: string;
  source?: ReactNode;
  lang?: Lang;
  size?: "md" | "lg" | "xl";
  /** Set when the figure sits directly on the table (not on a card). */
  onTable?: boolean;
  /** Centre on the card axis (intro cards). Default "start". */
  align?: "start" | "center";
  className?: string;
}

export function PeopleFigure({
  value, unit, sentence, approx = true, approxLabel = "about", source, lang = "en", size = "lg", onTable, align = "start", className,
}: PeopleFigureProps) {
  const shown = approx ? humanRound(value) : Math.round(value);
  const rounded = approx && isApprox(value);
  return (
    <figure className={clsx("ks-people", `ks-people--${size}`, onTable && "ks-on-table", align === "center" && "ks-people--center", className)}>
      <p className="ks-people__num">
        <span>
          {rounded ? (
            <>
              <span className="ks-people__approx" aria-hidden="true">≈</span>
              <span className="sr-only">{approxLabel} </span>
            </>
          ) : null}
          <span style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>{formatNumber(shown, lang)}</span>
        </span>
        <span className="ks-people__unit">{unit}</span>
      </p>
      {sentence ? <figcaption className="ks-people__sentence">{sentence}</figcaption> : null}
      {source ? <p className="ks-people__source">{source}</p> : null}
    </figure>
  );
}
