"use client";
// "Place on table" — the visible, non-drag path into Compare. Registers the card's
// comparable fields with the provider so the tray and table can render it.
import { useEffect, useLayoutEffect, useRef } from "react";
import { useOptionalCompare, type CompareItem } from "./Compare";
import { Icon } from "./Icon";

export interface TableToggleProps {
  item: CompareItem;
  placeLabel?: string;
  onTableLabel?: string;
  /** Static render for galleries: force the pressed state without a provider. */
  pressed?: boolean;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function TableToggle({ item, placeLabel = "Place on table", onTableLabel = "On table", pressed }: TableToggleProps) {
  const ctx = useOptionalCompare();
  const btn = useRef<HTMLButtonElement>(null);
  const register = ctx?.register;

  useEffect(() => {
    register?.(item);
  }, [register, item]);

  // Mark the host card so the global T shortcut knows which card has focus.
  useIsoLayoutEffect(() => {
    const host = btn.current?.closest<HTMLElement>(".ks-card");
    if (!host) return;
    host.dataset.tableRef = item.ref;
    host.dataset.tableName = item.name;
  }, [item.ref, item.name]);

  const on = pressed ?? ctx?.has(item.ref) ?? false;
  return (
    <button
      ref={btn}
      type="button"
      className="ks-table-toggle"
      aria-pressed={on}
      onClick={() => ctx?.toggle(item.ref, item.name)}
      aria-keyshortcuts="T"
    >
      <Icon name={on ? "check" : "plus"} size={16} />
      {on ? onTableLabel : placeLabel}
      <span className="sr-only">: {item.name}</span>
    </button>
  );
}
