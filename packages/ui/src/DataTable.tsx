"use client";
// Sortable accessible table in plain React (no TanStack in @ks/ui). aria-sort on headers,
// sort buttons, optional row links, and it reports its order so a map can follow it.
import clsx from "clsx";
import type { Lang } from "@ks/contracts";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatNumber, formatPercent, humanRound } from "./format";
import { Icon } from "./Icon";
import { UiLink } from "./UiLink";

/** "gap": people short; a negative gap is a surplus and reads "{n} too many", never "-920". */
export type ColumnFormat = "text" | "number" | "percent" | "people" | "decimal" | "gap";

export interface DataColumn<T> {
  key: string;
  header: string;
  format?: ColumnFormat;
  /** Client-side only: custom cell renderer. */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting when it differs from row[key]. */
  sortValue?: (row: T) => number | string | null;
  sortable?: boolean;
  /** Make this column's cell a link using rowHref. Default: first column. */
  link?: boolean;
}

export type SortDir = "ascending" | "descending";

export interface DataTableLabels {
  sortBy: string; // "Sort by {col}"
  empty: string;
  surplus: string; // "{n} too many"
}

export interface DataTableProps<T extends Record<string, unknown>> {
  caption: string;
  columns: Array<DataColumn<T>>;
  rows: T[];
  rowKey: keyof T & string;
  initialSort?: { key: string; dir: SortDir };
  /** Called with row keys in display order whenever sorting changes. */
  onOrderChange?: (keys: string[]) => void;
  /** Link template, e.g. "/districts/{lgd}". Placeholders read row fields. */
  rowHref?: string;
  selectedKey?: string | null;
  onRowFocus?: (key: string) => void;
  lang?: Lang;
  labels?: Partial<DataTableLabels>;
  className?: string;
}

function fmt(v: unknown, f: ColumnFormat | undefined, lang: Lang, surplus = "{n} too many"): ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v !== "number") return String(v);
  switch (f) {
    case "percent": return formatPercent(v, lang);
    case "people": return formatNumber(humanRound(v), lang);
    case "gap": return v < 0 ? surplus.replace("{n}", formatNumber(humanRound(-v), lang)) : formatNumber(humanRound(v), lang);
    case "decimal": return formatNumber(v, lang, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    case "text": return String(v);
    default: return formatNumber(v, lang);
  }
}

export function hrefFrom(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(String(row[k] ?? "")));
}

export function DataTable<T extends Record<string, unknown>>({
  caption, columns, rows, rowKey, initialSort, onOrderChange, rowHref, selectedKey, onRowFocus, lang = "en", labels, className,
}: DataTableProps<T>) {
  const L = { sortBy: "Sort by {col}", empty: "No rows yet.", surplus: "{n} too many", ...labels };
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const get = (r: T) => (col?.sortValue ? col.sortValue(r) : (r[sort.key] as number | string | null));
    const out = [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), lang === "mr" ? "mr" : "en");
      return sort.dir === "ascending" ? c : -c;
    });
    return out;
  }, [rows, columns, sort, lang]);

  const orderKey = sorted.map((r) => String(r[rowKey])).join("|");
  useEffect(() => {
    onOrderChange?.(orderKey ? orderKey.split("|") : []);
  }, [orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(key: string, numeric: boolean) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: numeric ? "descending" : "ascending" };
      return { key, dir: s.dir === "ascending" ? "descending" : "ascending" };
    });
  }

  const linkCol = columns.find((c) => c.link)?.key ?? columns[0]?.key;

  return (
    <div className={clsx("ks-dt-wrap", className)} role="region" aria-label={caption} tabIndex={0}>
      <table className="ks-dt">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const numeric = !!c.format && c.format !== "text";
              const state = sort?.key === c.key ? sort.dir : "none";
              const canSort = c.sortable !== false;
              return (
                <th key={c.key} scope="col" aria-sort={canSort ? state : undefined} data-numeric={numeric ? "true" : undefined}>
                  {canSort ? (
                    <button type="button" className="ks-dt__sort" data-numeric={numeric ? "true" : undefined} onClick={() => toggle(c.key, numeric)}>
                      {c.header}
                      <Icon className="ks-dt__sort-icon" name={state === "ascending" ? "caret-up" : state === "descending" ? "caret-down" : "sort"} size={14} />
                      <span className="sr-only">{`, ${L.sortBy.replace("{col}", c.header)}`}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{L.empty}</td>
            </tr>
          ) : (
            sorted.map((r) => {
              const k = String(r[rowKey]);
              return (
                <tr key={k} data-selected={selectedKey === k ? "true" : undefined} onFocus={onRowFocus ? () => onRowFocus(k) : undefined}>
                  {columns.map((c, ci) => {
                    const numeric = !!c.format && c.format !== "text";
                    const content = c.cell ? c.cell(r) : fmt(r[c.key], c.format, lang, L.surplus);
                    const Tag = ci === 0 ? "th" : "td";
                    return (
                      <Tag key={c.key} scope={ci === 0 ? "row" : undefined} data-numeric={numeric ? "true" : undefined}>
                        {rowHref && c.key === linkCol ? <UiLink href={hrefFrom(rowHref, r)}>{content}</UiLink> : content}
                      </Tag>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
