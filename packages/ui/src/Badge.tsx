// A signal is always glyph + word, never colour alone. Use on stock only.
import clsx from "clsx";

export type Tone = "gap" | "ok" | "watch" | "neutral";

const GLYPH: Record<Tone, string> = { gap: "▲", ok: "✓", watch: "~", neutral: "·" };

export interface BadgeProps {
  tone?: Tone;
  /** The word: SHORTAGE, HEALTHY, REVISE... */
  children: string;
  /** Override the default glyph, e.g. "▼" for OVERSUPPLY. */
  glyph?: string;
  solid?: boolean;
  className?: string;
}

export function Badge({ tone = "neutral", children, glyph, solid, className }: BadgeProps) {
  return (
    <span className={clsx("ks-badge", `ks-badge--${tone}`, solid && "ks-badge--solid", className)}>
      <span className="ks-badge__glyph" aria-hidden="true">
        {glyph ?? GLYPH[tone]}
      </span>
      {children}
    </span>
  );
}

/** Verdict presets for the four course flags and three demand states. */
export const VERDICTS = {
  SHORTAGE: { tone: "gap", glyph: "▲" },
  OVERSUPPLY: { tone: "watch", glyph: "▼" },
  BALANCED: { tone: "ok", glyph: "=" },
  HEALTHY: { tone: "ok", glyph: "✓" },
  REVISE: { tone: "watch", glyph: "~" },
  OVERSUPPLIED: { tone: "watch", glyph: "▼" },
  OBSOLETE: { tone: "gap", glyph: "✕" },
} as const satisfies Record<string, { tone: Tone; glyph: string }>;
