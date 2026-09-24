// A pressed seal: local employers endorsed this. Emboss is decoration (feDiffuseLighting at 6%);
// the meaning lives in aria-label and the optional visible label.
import { useId } from "react";

export interface SealProps {
  count: number;
  /** Full sentence, e.g. "Endorsed by 4 Nashik employers". Used as aria-label and visible label. */
  label: string;
  showLabel?: boolean;
  size?: number;
  className?: string;
}

function scallop(cx: number, cy: number, r: number, teeth = 24, depth = 2.2): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (Math.PI * i) / teeth;
    const rr = i % 2 === 0 ? r : r - depth;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function Seal({ count, label, showLabel = false, size = 48, className }: SealProps) {
  const id = useId().replace(/:/g, "");
  const shown = count > 99 ? "99+" : String(count);
  return (
    <span className={["ks-seal", className].filter(Boolean).join(" ")}>
      <svg className="ks-seal__mark" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={label}>
        <defs>
          <filter id={`emb-${id}`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="b" />
            <feDiffuseLighting in="b" surfaceScale="3" diffuseConstant="1" lightingColor="#EFE8D8" result="l">
              <feDistantLight azimuth="225" elevation="45" />
            </feDiffuseLighting>
            <feComposite in="l" in2="SourceAlpha" operator="in" result="lit" />
            <feComponentTransfer in="lit" result="soft">
              <feFuncA type="linear" slope="0.06" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="soft" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#emb-${id})`}>
          <polygon points={scallop(24, 24, 22)} fill="none" stroke="var(--ink)" strokeWidth="1" />
          <circle cx="24" cy="24" r="15.5" fill="none" stroke="var(--ink)" strokeWidth=".75" />
          <circle cx="24" cy="24" r="13.5" fill="none" stroke="var(--ink-faint)" strokeWidth=".5" strokeDasharray="1 1.6" />
        </g>
        <text className="ks-seal__count" x="24" y="28.5" textAnchor="middle" aria-hidden="true">
          {shown}
        </text>
      </svg>
      {showLabel ? <span className="ks-seal__label" aria-hidden="true">{label}</span> : null}
    </span>
  );
}
