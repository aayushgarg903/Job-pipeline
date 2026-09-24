// Observable Plot presets (Design.md §6). Pure: take the Plot module + resolved token colours.
import type * as PlotNS from "@observablehq/plot";

export type ChartSpec =
  | { kind: "lineBand"; data: Array<{ x: string; y: number; low?: number; high?: number; forecast?: boolean }>; yLabel?: string; forecastLabel?: string }
  | { kind: "barSorted"; data: Array<{ label: string; value: number; highlight?: boolean }>; xLabel?: string; valueFormat?: "number" | "percent" }
  | { kind: "slope"; data: Array<{ label: string; before: number; after: number }>; beforeLabel: string; afterLabel: string }
  | { kind: "dotMatrix"; data: Array<{ row: string; col: string; covered: boolean }>; colOrder?: string[] };

export interface ChartColors {
  ink: string;
  muted: string;
  faint: string;
  gap: string;
  ok: string;
  highlight: string;
  stock: string;
  font: string;
}

type Plot = typeof PlotNS;

const base = (c: ChartColors, width: number) => ({
  width,
  marginLeft: 48,
  style: { background: "transparent", color: c.ink, fontFamily: c.font, fontSize: "12px", overflow: "visible" },
});

export function buildChart(Plot: Plot, spec: ChartSpec, c: ChartColors, width: number, height: number): SVGSVGElement | HTMLElement {
  switch (spec.kind) {
    case "lineBand": {
      const d = spec.data;
      const hasBand = d.some((p) => p.low !== undefined && p.high !== undefined);
      const firstForecast = d.find((p) => p.forecast);
      return Plot.plot({
        ...base(c, width), height,
        x: { type: "point", label: null, tickRotate: d.length > 10 ? -30 : 0 },
        y: { grid: true, label: spec.yLabel ?? null, nice: true },
        marks: [
          Plot.gridY({ stroke: c.faint, strokeOpacity: 0.4 }),
          hasBand ? Plot.areaY(d.filter((p) => p.low !== undefined), { x: "x", y1: "low", y2: "high", fill: c.muted, fillOpacity: 0.18, curve: "linear" }) : null,
          Plot.lineY(d.filter((p) => !p.forecast || p === firstForecast), { x: "x", y: "y", stroke: c.ink, strokeWidth: 1.6 }),
          Plot.lineY(d.filter((p, i) => p.forecast || d[i + 1]?.forecast), { x: "x", y: "y", stroke: c.highlight, strokeWidth: 1.6, strokeDasharray: "4 3" }),
          Plot.dot(d, { x: "x", y: "y", r: 2.2, fill: (p: { forecast?: boolean }) => (p.forecast ? c.highlight : c.ink) }),
          firstForecast ? Plot.ruleX([firstForecast.x], { stroke: c.faint, strokeDasharray: "2 3" }) : null,
          firstForecast ? Plot.text([firstForecast], { x: "x", y: "y", text: () => spec.forecastLabel ?? "forecast", dy: -12, dx: 4, textAnchor: "start", fill: c.muted }) : null,
          Plot.ruleY([0], { stroke: c.faint }),
        ],
      });
    }
    case "barSorted": {
      const pct = spec.valueFormat === "percent";
      const fmt = (v: number) => (pct ? `${Math.round(v * 100)}%` : v.toLocaleString("en-IN"));
      const rows = [...spec.data].sort((a, b) => b.value - a.value);
      return Plot.plot({
        ...base(c, width),
        marginLeft: 140, marginRight: 56,
        height: Math.max(120, rows.length * 26 + 30),
        x: { grid: true, label: spec.xLabel ?? null, axis: "top", tickFormat: pct ? "%" : undefined },
        y: { label: null, domain: rows.map((r) => r.label) },
        marks: [
          Plot.gridX({ stroke: c.faint, strokeOpacity: 0.4 }),
          Plot.barX(rows, { x: "value", y: "label", fill: (r: { highlight?: boolean }) => (r.highlight ? c.highlight : c.ink), insetTop: 3, insetBottom: 3 }),
          Plot.text(rows, { x: "value", y: "label", text: (r: { value: number }) => fmt(r.value), dx: 6, textAnchor: "start", fill: c.ink }),
          Plot.ruleX([0], { stroke: c.ink }),
        ],
      });
    }
    case "slope": {
      const pts = spec.data.flatMap((r) => [
        { label: r.label, side: spec.beforeLabel, v: r.before, r },
        { label: r.label, side: spec.afterLabel, v: r.after, r },
      ]);
      const colour = (r: { before: number; after: number }) => (r.after < r.before ? c.gap : r.after > r.before ? c.ok : c.muted);
      return Plot.plot({
        ...base(c, width), height,
        marginLeft: Math.min(220, width * 0.3), marginRight: Math.min(220, width * 0.3),
        x: { type: "point", domain: [spec.beforeLabel, spec.afterLabel], label: null, axis: "top", padding: 0.1 },
        y: { axis: null, nice: true },
        marks: [
          Plot.link(spec.data, { x1: () => spec.beforeLabel, x2: () => spec.afterLabel, y1: "before", y2: "after", stroke: colour, strokeWidth: 1.8 }),
          Plot.dot(pts, { x: "side", y: "v", r: 3, fill: (p: { r: { before: number; after: number } }) => colour(p.r) }),
          Plot.text(pts.filter((p) => p.side === spec.beforeLabel), { x: "side", y: "v", text: (p: { label: string; v: number }) => `${p.label}  ${p.v}`, dx: -8, textAnchor: "end", fill: c.ink }),
          Plot.text(pts.filter((p) => p.side === spec.afterLabel), { x: "side", y: "v", text: (p: { label: string; v: number }) => `${p.v}  ${p.label}`, dx: 8, textAnchor: "start", fill: c.ink }),
        ],
      });
    }
    case "dotMatrix": {
      const cols = spec.colOrder ?? [...new Set(spec.data.map((d) => d.col))];
      const rows = [...new Set(spec.data.map((d) => d.row))];
      return Plot.plot({
        ...base(c, width),
        marginLeft: 180,
        height: Math.max(120, rows.length * 28 + 40),
        x: { domain: cols, label: null, axis: "top", padding: 0.2 },
        y: { domain: rows, label: null },
        marks: [
          Plot.dot(spec.data, {
            x: "col", y: "row", r: 7, stroke: c.ink, strokeWidth: 1.4,
            fill: (d: { covered: boolean }) => (d.covered ? c.ink : c.stock),
            symbol: "circle",
          }),
        ],
      });
    }
  }
}

/** Rows + headers for the "Show as table" view and CSV export. */
export function chartTable(spec: ChartSpec, headers?: Record<string, string>): { head: string[]; rows: Array<Array<string | number>> } {
  const H = (k: string, d: string) => headers?.[k] ?? d;
  switch (spec.kind) {
    case "lineBand":
      return {
        head: [H("x", "Quarter"), H("y", "Value"), H("low", "Low"), H("high", "High"), H("forecast", "Forecast")],
        rows: spec.data.map((p) => [p.x, p.y, p.low ?? "", p.high ?? "", p.forecast ? H("yes", "yes") : ""]),
      };
    case "barSorted":
      return { head: [H("label", "Name"), H("value", "Value")], rows: [...spec.data].sort((a, b) => b.value - a.value).map((r) => [r.label, r.value]) };
    case "slope":
      return { head: [H("label", "Name"), spec.beforeLabel, spec.afterLabel, H("change", "Change")], rows: spec.data.map((r) => [r.label, r.before, r.after, r.after - r.before]) };
    case "dotMatrix":
      return { head: [H("row", "Skill"), H("col", "Importance"), H("covered", "Taught")], rows: spec.data.map((d) => [d.row, d.col, d.covered ? H("yes", "yes") : H("no", "no")]) };
  }
}

export function toCsv(t: { head: string[]; rows: Array<Array<string | number>> }): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.head, ...t.rows].map((r) => r.map(esc).join(",")).join("\n");
}
