"use client";
// Observable Plot wrapper. Renders SVG in useEffect (Plot is loaded lazily), always with a
// one-sentence summary (aria-describedby), a "Show as table" toggle and CSV export.
import clsx from "clsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { buildChart, chartTable, toCsv, type ChartColors, type ChartSpec } from "./plotPresets";

export type { ChartSpec } from "./plotPresets";

export interface PlotChartLabels {
  showTable: string;
  showChart: string;
  csv: string;
  loading: string;
}

export const PLOT_LABELS_EN: PlotChartLabels = { showTable: "Show as table", showChart: "Show as chart", csv: "Download CSV", loading: "Drawing the chart…" };

export interface PlotChartProps {
  title: string;
  /** One plain sentence describing what the chart shows. Required: charts are never mute. */
  summary: string;
  chart: ChartSpec;
  height?: number;
  /** File name for the CSV export (without extension). */
  csvName?: string;
  /** Column header overrides for table + CSV (keys: x, y, low, high, label, value, row, col, covered, yes, no...). */
  headers?: Record<string, string>;
  labels?: Partial<PlotChartLabels>;
  /** Start in table view (e.g. print, low bandwidth). */
  initialView?: "chart" | "table";
  className?: string;
}

function readColors(el: HTMLElement): ChartColors {
  const s = getComputedStyle(el);
  const v = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb;
  return {
    ink: v("--ink", "#1C1A17"), muted: v("--ink-muted", "#5E574C"), faint: v("--ink-faint", "#756D60"),
    gap: v("--signal-gap", "#7A1F24"), ok: v("--signal-ok", "#2E4A3B"), highlight: v("--signal-watch", "#7A5A12"),
    stock: v("--stock-bone", "#EFE8D8"), font: s.fontFamily,
  };
}

export function PlotChart({ title, summary, chart, height = 260, csvName, headers, labels, initialView = "chart", className }: PlotChartProps) {
  const L = { ...PLOT_LABELS_EN, ...labels };
  const [view, setView] = useState<"chart" | "table">(initialView);
  const [ready, setReady] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const sumId = useId();
  const table = useMemo(() => chartTable(chart, headers), [chart, headers]);

  useEffect(() => {
    if (view !== "chart") return;
    const el = host.current;
    if (!el) return;
    let live = true;
    let ro: ResizeObserver | null = null;
    import("@observablehq/plot").then((Plot) => {
      if (!live) return;
      const draw = () => {
        const w = Math.max(280, Math.floor(el.clientWidth));
        const node = buildChart(Plot, chart, readColors(el), w, height);
        // Plot labels each mark group ("bar", "rule"); inside role="img" those are noise and invalid on <g>.
        node.querySelectorAll("g[aria-label]").forEach((g) => g.removeAttribute("aria-label"));
        node.setAttribute("role", "img");
        node.setAttribute("aria-labelledby", titleId);
        node.setAttribute("aria-describedby", sumId);
        el.replaceChildren(node);
        setReady(true);
      };
      draw();
      let last = el.clientWidth;
      ro = new ResizeObserver(() => {
        if (Math.abs(el.clientWidth - last) > 24) {
          last = el.clientWidth;
          draw();
        }
      });
      ro.observe(el);
    });
    return () => {
      live = false;
      ro?.disconnect();
    };
  }, [chart, height, view, titleId, sumId]);

  function downloadCsv() {
    const blob = new Blob([`﻿${toCsv(table)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(csvName ?? title).replace(/[^\wऀ-ॿ-]+/g, "-").toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <figure className={clsx("ks-chart ks-stock", className)} style={{ ["--chart-h" as string]: `${height}px` }} aria-labelledby={titleId}>
      <div className="ks-chart__head">
        <h3 id={titleId} className="ks-chart__title">{title}</h3>
        <div className="ks-chart__tools">
          <button type="button" className="ks-btn ks-btn--secondary ks-btn--sm" aria-pressed={view === "table"} onClick={() => setView(view === "chart" ? "table" : "chart")}>
            <Icon name={view === "chart" ? "rows" : "chart"} size={16} />
            {view === "chart" ? L.showTable : L.showChart}
          </button>
          <button type="button" className="ks-btn ks-btn--secondary ks-btn--sm" onClick={downloadCsv}>
            <Icon name="download" size={16} />
            {L.csv}
          </button>
        </div>
      </div>
      <p id={sumId} className="ks-chart__summary">{summary}</p>
      {view === "chart" ? (
        <div className="ks-chart__plot">
          {!ready ? <div className="ks-chart__loading ks-skeleton" aria-hidden="true" /> : null}
          <div ref={host} style={ready ? undefined : { position: "absolute", width: "100%", visibility: "hidden" }} />
          {!ready ? <span className="sr-only" role="status">{L.loading}</span> : null}
        </div>
      ) : (
        <div className="ks-dt-wrap" role="region" aria-labelledby={titleId} tabIndex={0}>
          <table className="ks-dt">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j} data-numeric={typeof v === "number" ? "true" : undefined}>{typeof v === "number" ? v.toLocaleString("en-IN") : v}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
