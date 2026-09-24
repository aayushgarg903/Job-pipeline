"use client";
// Cards laid side by side. Fields that differ beyond a threshold get an oxblood hairline
// underline plus a text marker; one sentence (from computed diffs) summarises the gap.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { fieldDiffers, type CompareItem } from "./compareCore";
import { Icon } from "./Icon";

export interface CompareTableLabels {
  caption: string;
  field: string;
  differs: string;
  summary: string;
  remove: string; // "Take {name} off the table"
  empty: string;
}

export const COMPARE_TABLE_LABELS_EN: CompareTableLabels = {
  caption: "Cards on the table, field by field. Underlined values differ.",
  field: "Field",
  differs: "differs",
  summary: "Where they differ",
  remove: "Take off the table",
  empty: "Nothing on the table yet. Use “Place on table” on any card, or press T while a card is focused.",
};

export interface CompareTableProps {
  items: CompareItem[];
  /** The one-sentence diff summary (Gemini-drafted from computed diffs, or plain text). */
  summary?: ReactNode;
  /** Relative spread for numbers to count as different. Default 0.15 (15%). */
  threshold?: number;
  onRemove?: (ref: string) => void;
  labels?: Partial<CompareTableLabels>;
}

export function CompareTable({ items, summary, threshold = 0.15, onRemove, labels }: CompareTableProps) {
  const L = { ...COMPARE_TABLE_LABELS_EN, ...labels };
  const reduce = useReducedMotion();
  if (items.length === 0) return <p className="ks-compare__empty">{L.empty}</p>;

  const keys: Array<{ key: string; label: string }> = [];
  for (const it of items) for (const f of it.fields) if (!keys.some((k) => k.key === f.key)) keys.push({ key: f.key, label: f.label });
  const cell = (it: CompareItem, key: string) => it.fields.find((f) => f.key === key);

  return (
    <div className="ks-compare">
      <motion.ul className="ks-compare__cards" style={{ ["--n" as string]: items.length }} layout={!reduce}>
        <AnimatePresence initial={!reduce}>
          {items.map((it, i) => (
            <motion.li
              key={it.ref}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 16, transition: { duration: 0.2 } }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32, delay: Math.min(i, 8) * 0.04 }}
              className="ks-compare__mini"
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span className="ks-compare__mini-code">{it.code ?? it.ref}</span>
                {onRemove ? (
                  <button type="button" className="ks-tray__remove" onClick={() => onRemove(it.ref)} aria-label={`${L.remove}: ${it.name}`}>
                    <Icon name="x" size={16} />
                  </button>
                ) : null}
              </div>
              <p className="ks-compare__mini-name">{it.name}</p>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {summary ? (
        <p className="ks-compare__summary" aria-live="polite">
          <span className="ks-compare__summary-label">{L.summary}</span>
          {summary}
        </p>
      ) : null}

      <div className="ks-compare__scroll" tabIndex={0} role="region" aria-label={L.caption}>
        <table className="ks-compare__table">
          <caption>{L.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{L.field}</th>
              {items.map((it) => (
                <th scope="col" key={it.ref}>
                  {it.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map(({ key, label }) => {
              const vals = items.map((it) => cell(it, key)?.value ?? null);
              const differs = fieldDiffers(vals, threshold);
              return (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {items.map((it) => {
                    const f = cell(it, key);
                    const text = f ? (f.display ?? String(f.value ?? "—")) : "—";
                    return (
                      <td key={it.ref} data-numeric={typeof f?.value === "number" ? "true" : undefined}>
                        {differs ? (
                          <>
                            <span className="ks-diff">{text}</span>
                            <span className="sr-only"> ({L.differs})</span>
                          </>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
