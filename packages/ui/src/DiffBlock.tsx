// Curriculum Pull Request diff (Design.md §4.3), set in card typography.
//   MODULE 4 — Spreadsheet Analysis                   40h
// - Lotus-style macros                    6h   demand −61% YoY
// + Power BI dashboards                  10h   312 postings · 11 employers Mandatory
// ~ Excel Pivot Tables                4h → 8h
import type { DiffLine, Lang } from "@ks/contracts";
import clsx from "clsx";
import { formatNumber } from "./format";

export interface DiffLabels {
  add: string;
  drop: string;
  resize: string;
  keep: string;
  hours: string; // unit suffix, "h"
  item: string;
  change: string;
  why: string;
  caption: string;
}

export const DIFF_LABELS_EN: DiffLabels = {
  add: "Add", drop: "Drop", resize: "Change hours", keep: "Keep", hours: "h",
  item: "Module or skill", change: "Change", why: "Why", caption: "Proposed changes to this course",
};

const SIGN: Record<DiffLine["op"], string> = { add: "+", drop: "−", resize: "~", keep: " " };

export interface DiffBlockProps {
  lines: DiffLine[];
  /** skillId -> readable label. Falls back to the module name. */
  skillLabels?: Record<string, string>;
  title?: string;
  /** Hide unchanged lines. Default false. */
  hideKeep?: boolean;
  lang?: Lang;
  labels?: Partial<DiffLabels>;
  className?: string;
}

export function DiffBlock({ lines, skillLabels = {}, title, hideKeep = false, lang = "en", labels, className }: DiffBlockProps) {
  const L = { ...DIFF_LABELS_EN, ...labels };
  const h = (n: number) => `${formatNumber(n, lang)}${L.hours}`;
  const groups: Array<{ module: string; lines: DiffLine[] }> = [];
  for (const line of lines) {
    if (hideKeep && line.op === "keep") continue;
    const g = groups.find((x) => x.module === line.module);
    if (g) g.lines.push(line);
    else groups.push({ module: line.module, lines: [line] });
  }

  return (
    <figure className={clsx("ks-diffblock ks-stock", className)}>
      {title ? <figcaption className="ks-diffblock__title">{title}</figcaption> : null}
      <table>
        <caption className="sr-only">{title ?? L.caption}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{L.change}</th>
            <th scope="col">{L.item}</th>
            <th scope="col">{L.hours}</th>
            <th scope="col">{L.why}</th>
          </tr>
        </thead>
        {groups.map((g) => {
          const after = g.lines.reduce((s, l) => s + l.hoursAfter, 0);
          return (
            <tbody key={g.module}>
              <tr className="ks-diffblock__module">
                <th scope="rowgroup" colSpan={2}>
                  {g.module}
                </th>
                <th scope="col" className="ks-diffblock__hours">
                  {h(after)}
                </th>
                <th aria-hidden="true" />
              </tr>
              {g.lines.map((l, i) => {
                const label = (l.skillId && skillLabels[l.skillId]) || l.skillId || l.module;
                return (
                  <tr key={`${l.skillId ?? l.module}-${i}`} data-op={l.op}>
                    <td className="ks-diffblock__sign">
                      <span aria-hidden="true">{SIGN[l.op]}</span>
                      <span className="sr-only">{L[l.op]}</span>
                    </td>
                    <td className="ks-diffblock__item">
                      {l.op === "add" ? <ins>{label}</ins> : l.op === "drop" ? <del>{label}</del> : label}
                    </td>
                    <td className="ks-diffblock__hours">
                      {l.op === "add" ? h(l.hoursAfter) : l.op === "drop" ? h(l.hoursBefore) : l.op === "resize" ? `${h(l.hoursBefore)} → ${h(l.hoursAfter)}` : h(l.hoursAfter)}
                    </td>
                    <td className="ks-diffblock__reason">{l.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </figure>
  );
}
