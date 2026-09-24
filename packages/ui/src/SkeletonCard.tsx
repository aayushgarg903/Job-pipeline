// Loading placeholder that reserves the card's aspect-ratio box (no CLS, never an empty axis frame).
import clsx from "clsx";
import type { CardVariant } from "./Card";

export interface SkeletonCardProps {
  variant?: CardVariant;
  /** When set, announced once as a polite status ("Loading district cards"). */
  label?: string;
  expanded?: boolean;
  className?: string;
}

export function SkeletonCard({ variant = "skill", label, expanded, className }: SkeletonCardProps) {
  return (
    <div
      className={clsx("ks-card", `ks-card--${variant}`, expanded && "ks-card--expanded", "ks-skeleton", className)}
      aria-busy="true"
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label ? <span className="sr-only">{label}</span> : null}
      <span className="ks-skeleton__bar ks-skeleton__bar--name" />
      <span className="ks-skeleton__bar ks-skeleton__bar--title" />
      <span className="ks-skeleton__bar ks-skeleton__bar--line" />
      <span className="ks-skeleton__bar ks-skeleton__bar--line" style={{ width: "55%" }} />
    </div>
  );
}
