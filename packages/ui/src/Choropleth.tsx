"use client";
// Maharashtra's 36 districts as an SVG choropleth (d3-geo). Classed 5-step sepia ramp,
// outlines always drawn, hatching where coverage < 0.4 ("low signal"), labelled legend,
// and one tab stop: arrow keys move district to district in the paired table's order.
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Lang } from "@ks/contracts";
import { formatNumber } from "./format";

export interface DistrictFeature {
  type: "Feature";
  properties: { lgd: string; name: string; [k: string]: unknown };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}
export interface DistrictGeo {
  type: "FeatureCollection";
  features: DistrictFeature[];
}

export interface ChoroplethDatum {
  lgd: string;
  name: string;
  value: number | null;
  coverage: number;
  /** Formatted value for readout and aria-label. */
  display?: string;
}

export interface ChoroplethLabels {
  legendTitle: string;
  lowSignal: string; // "Low signal: survey-weighted"
  noData: string;
  mapLabel: string; // "Map of Maharashtra's districts"
  instructions: string;
}

export const CHOROPLETH_LABELS_EN: ChoroplethLabels = {
  legendTitle: "How far training is from jobs",
  lowSignal: "Low signal: survey-weighted",
  noData: "No data yet",
  mapLabel: "Map of Maharashtra's 36 districts",
  instructions: "Use the arrow keys to move between districts in table order. Press Enter to open one.",
};

export interface ChoroplethProps {
  geo: DistrictGeo;
  data: ChoroplethDatum[];
  /** Four ascending thresholds splitting values into 5 classes. Default: quintiles of the data. */
  breaks?: [number, number, number, number];
  /** District keyboard order (e.g. the paired table's sort). Default: data order. */
  order?: string[];
  selected?: string | null;
  onSelect?: (lgd: string) => void;
  /** Used when no onSelect is given (Server Component parents): "/districts/{lgd}". */
  hrefTemplate?: string;
  onFocusDistrict?: (lgd: string) => void;
  lowCoverage?: number;
  width?: number;
  height?: number;
  lang?: Lang;
  labels?: Partial<ChoroplethLabels>;
  formatBreak?: (n: number) => string;
}

function quintiles(values: number[]): [number, number, number, number] {
  const v = [...values].sort((a, b) => a - b);
  const q = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))] ?? 0;
  return [q(0.2), q(0.4), q(0.6), q(0.8)];
}

export function classOf(v: number | null, breaks: readonly number[]): number {
  if (v === null || Number.isNaN(v)) return 0;
  let c = 1;
  for (const b of breaks) if (v > b) c++;
  return c;
}

export function Choropleth({
  geo, data, breaks, order, selected, onSelect, hrefTemplate, onFocusDistrict, lowCoverage = 0.4,
  width = 600, height = 620, lang = "en", labels, formatBreak,
}: ChoroplethProps) {
  const L = { ...CHOROPLETH_LABELS_EN, ...labels };
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const byLgd = useMemo(() => new Map(data.map((d) => [d.lgd, d])), [data]);
  const cuts = useMemo(() => breaks ?? quintiles(data.map((d) => d.value).filter((v): v is number => v !== null)), [breaks, data]);
  const fb = formatBreak ?? ((n: number) => formatNumber(n, lang, { maximumFractionDigits: 2 }));

  const paths = useMemo(() => {
    const projection = geoMercator().fitSize([width, height], geo as unknown as GeoPermissibleObjects);
    // One decimal is a tenth of a pixel on this viewBox; the default (3) nearly doubles the path text.
    const path = geoPath(projection).digits(1);
    return geo.features.map((f) => ({ lgd: f.properties.lgd, name: f.properties.name, d: path(f as unknown as GeoPermissibleObjects) ?? "" }));
  }, [geo, width, height]);

  const seq = useMemo(() => {
    const known = new Set(paths.map((p) => p.lgd));
    const base = (order ?? data.map((d) => d.lgd)).filter((l) => known.has(l));
    for (const p of paths) if (!base.includes(p.lgd)) base.push(p.lgd);
    return base;
  }, [order, data, paths]);

  const [active, setActive] = useState<string | null>(null);
  const tabStop = active ?? selected ?? seq[0] ?? null;
  const readoutFor = (lgd: string | null) => {
    if (!lgd) return "";
    const d = byLgd.get(lgd);
    const p = paths.find((x) => x.lgd === lgd);
    const name = d?.name ?? p?.name ?? lgd;
    if (!d || d.value === null) return `${name}: ${L.noData}`;
    return `${name}: ${d.display ?? fb(d.value)}${d.coverage < lowCoverage ? ` · ${L.lowSignal}` : ""}`;
  };

  function choose(lgd: string) {
    if (onSelect) onSelect(lgd);
    else if (hrefTemplate) window.location.assign(hrefTemplate.replace("{lgd}", encodeURIComponent(lgd)));
  }

  function focusDistrict(lgd: string) {
    setActive(lgd);
    onFocusDistrict?.(lgd);
    svgRef.current?.querySelector<SVGUseElement>(`[data-lgd="${lgd}"]`)?.focus();
  }

  function onKey(e: KeyboardEvent<SVGUseElement>, lgd: string) {
    const i = seq.indexOf(lgd);
    const go = (j: number) => {
      e.preventDefault();
      const next = seq[(j + seq.length) % seq.length];
      if (next) focusDistrict(next);
    };
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": return go(i + 1);
      case "ArrowLeft": case "ArrowUp": return go(i - 1);
      case "Home": return go(0);
      case "End": return go(seq.length - 1);
      case "Enter": case " ": e.preventDefault(); return choose(lgd);
    }
  }

  const steps = [0, 1, 2, 3, 4].map((i) => {
    const lo = i === 0 ? null : cuts[i - 1]!;
    const hi = i === 4 ? null : cuts[i]!;
    return { cls: i + 1, text: lo === null ? `≤ ${fb(hi!)}` : hi === null ? `> ${fb(lo)}` : `${fb(lo)} – ${fb(hi)}` };
  });
  const instrId = `${uid}-instr`;
  const ordered = [...paths].sort((a, b) => seq.indexOf(a.lgd) - seq.indexOf(b.lgd));

  return (
    <figure className="ks-map ks-stock" style={{ padding: 16 }}>
      <svg ref={svgRef} className="ks-map__svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={L.mapLabel} aria-describedby={instrId}>
        <defs>
          <pattern id={`${uid}-hatch`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="none" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--stock-bone)" strokeWidth="2.2" />
            <line x1="3" y1="0" x2="3" y2="6" stroke="var(--ink)" strokeWidth="0.9" />
          </pattern>
          {/* Each outline is sent once; the district, its hatch and the focus ring all <use> it. */}
          {paths.map((p) => <path key={p.lgd} id={`${uid}-g-${p.lgd}`} d={p.d} />)}
        </defs>
        {ordered.map((p) => {
          const d = byLgd.get(p.lgd);
          const cls = classOf(d?.value ?? null, cuts);
          const low = d ? d.coverage < lowCoverage : true;
          return (
            <g key={p.lgd}>
              <use
                href={`#${uid}-g-${p.lgd}`}
                data-lgd={p.lgd}
                className={`ks-map__district ks-ramp-${cls}`}
                data-selected={selected === p.lgd ? "true" : undefined}
                tabIndex={tabStop === p.lgd ? 0 : -1}
                role="button"
                aria-label={readoutFor(p.lgd)}
                aria-pressed={selected ? selected === p.lgd : undefined}
                onKeyDown={(e) => onKey(e, p.lgd)}
                onFocus={() => {
                  setActive(p.lgd);
                  onFocusDistrict?.(p.lgd);
                }}
                onMouseEnter={() => setActive(p.lgd)}
                onClick={() => choose(p.lgd)}
              />
              {low ? <use href={`#${uid}-g-${p.lgd}`} className="ks-map__hatch" fill={`url(#${uid}-hatch)`} fillOpacity={cls >= 4 ? 0.9 : 0.55} aria-hidden="true" /> : null}
            </g>
          );
        })}
        {tabStop ? (() => {
          const p = paths.find((x) => x.lgd === (active ?? selected));
          return p ? (
            <g aria-hidden="true">
              <use href={`#${uid}-g-${p.lgd}`} className="ks-map__focus-ring" />
              <use href={`#${uid}-g-${p.lgd}`} className="ks-map__focus-ring-inner" />
            </g>
          ) : null;
        })() : null}
      </svg>
      <p id={instrId} className="sr-only">{L.instructions}</p>
      <p className="ks-map__readout" aria-hidden="true">{readoutFor(active ?? selected ?? null)}</p>
      <figcaption className="ks-legend">
        <span className="ks-legend__title">{L.legendTitle}</span>
        <ul className="ks-legend__steps">
          {steps.map((s) => (
            <li key={s.cls} className="ks-legend__step">
              <svg className="ks-legend__swatch" viewBox="0 0 22 14" aria-hidden="true">
                <rect width="22" height="14" className={`ks-ramp-${s.cls}`} />
              </svg>
              {s.text}
            </li>
          ))}
          <li className="ks-legend__step">
            <svg className="ks-legend__swatch" viewBox="0 0 22 14" aria-hidden="true">
              <rect width="22" height="14" className="ks-ramp-2" />
              <rect width="22" height="14" fill={`url(#${uid}-hatch)`} />
            </svg>
            {L.lowSignal}
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
