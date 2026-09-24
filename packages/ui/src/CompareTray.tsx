"use client";
// The docked tray at the bottom of the table: up to 4 cards. "Lay out" opens them side by side.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCompare, type CompareItem } from "./Compare";
import { CompareTable, type CompareTableLabels } from "./CompareTable";
import { fill } from "./format";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

export interface CompareTrayLabels {
  title: string; // "On the table ({n} of {max})"
  layOut: string;
  clear: string;
  remove: string;
  emptySlot: string;
  hint: string; // "Press T on a focused card"
  sheetTitle: string;
  close: string;
}

export const COMPARE_TRAY_LABELS_EN: CompareTrayLabels = {
  title: "On the table ({n} of {max})",
  layOut: "Lay the cards out",
  clear: "Clear the table",
  remove: "Take off the table",
  emptySlot: "Empty place",
  hint: "Press T on a focused card to add or remove it.",
  sheetTitle: "The table",
  close: "Close the table",
};

export interface CompareTrayProps {
  /** Server Action: fetch cards for refs not rendered on this page (e.g. from a shared link). */
  resolve?: (refs: string[]) => Promise<CompareItem[]>;
  /** Server Action: one grounded sentence about where the cards differ. */
  summarize?: (refs: string[]) => Promise<string>;
  /** Or a ready summary. */
  summary?: ReactNode;
  labels?: Partial<CompareTrayLabels>;
  tableLabels?: Partial<CompareTableLabels>;
}

export function CompareTray({ resolve, summarize, summary, labels, tableLabels }: CompareTrayProps) {
  const L = { ...COMPARE_TRAY_LABELS_EN, ...labels };
  const { refs, max, items, remove, clear, register, tableOpen, setTableOpen } = useCompare();
  const bar = useRef<HTMLElement>(null);
  const [sentence, setSentence] = useState<string | null>(null);
  const key = refs.join(",");

  // Resolve refs we have no card for (shared links).
  useEffect(() => {
    const missing = refs.filter((r) => !items.has(r));
    if (!resolve || missing.length === 0) return;
    let live = true;
    resolve(missing).then((got) => live && got.forEach(register), () => undefined);
    return () => {
      live = false;
    };
  }, [key, resolve]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSentence(null);
    if (!summarize || refs.length < 2 || !tableOpen) return;
    let live = true;
    summarize(refs).then((s) => live && setSentence(s), () => undefined);
    return () => {
      live = false;
    };
  }, [key, summarize, tableOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reserve space so the tray never hides focused content.
  useEffect(() => {
    const root = document.documentElement;
    const el = bar.current;
    if (!el || refs.length === 0) {
      root.style.setProperty("--tray-h", "0px");
      return;
    }
    const ro = new ResizeObserver(() => root.style.setProperty("--tray-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--tray-h", "0px");
    };
  }, [refs.length]);

  if (refs.length === 0) return null;
  const list = refs.map((r) => items.get(r) ?? { ref: r, name: r, fields: [] });

  return (
    <>
      <section ref={bar} className="ks-tray" aria-label={fill(L.title, { n: refs.length, max })}>
        <div className="ks-tray__inner">
          <p className="ks-tray__title">{fill(L.title, { n: refs.length, max })}</p>
          <ul className="ks-tray__slots">
            {list.map((it) => (
              <li key={it.ref} className="ks-tray__slot">
                <span className="ks-tray__slot-name">{it.name}</span>
                <button type="button" className="ks-tray__remove" onClick={() => remove(it.ref)} aria-label={`${L.remove}: ${it.name}`}>
                  <Icon name="x" size={16} />
                </button>
              </li>
            ))}
            {Array.from({ length: max - refs.length }, (_, i) => (
              <li key={`empty-${i}`} className="ks-tray__slot ks-tray__slot--empty" aria-hidden="true">
                {L.emptySlot}
              </li>
            ))}
          </ul>
          <div className="ks-tray__actions">
            <button type="button" className="ks-btn" onClick={() => setTableOpen(true)} aria-haspopup="dialog" disabled={refs.length < 1}>
              <Icon name="table" size={18} />
              {L.layOut}
            </button>
            <button type="button" className="ks-btn ks-btn--table" onClick={clear}>
              {L.clear}
            </button>
          </div>
          <p className="ks-tray__hint">{L.hint}</p>
        </div>
      </section>
      <Sheet open={tableOpen} onClose={() => setTableOpen(false)} title={L.sheetTitle} side="bottom" closeLabel={L.close}>
        <CompareTable items={list} summary={summary ?? sentence ?? undefined} onRemove={remove} labels={tableLabels} />
      </Sheet>
    </>
  );
}
