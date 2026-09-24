"use client";
// The Card Case (Design.md §4.1): cards slide out one after another (40ms stagger, max 8),
// arrow keys move between them, Enter opens. The entry is a CSS animation so cards are
// visible without JavaScript; under reduced motion the cards are simply there.
import { Children, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

export interface CardCaseProps {
  children: ReactNode;
  /** aria-label for the group, e.g. "Choose who you are". */
  label: string;
  className?: string;
}

export function CardCase({ children, label, className }: CardCaseProps) {
  const list = useRef<HTMLUListElement>(null);

  function items(): HTMLElement[] {
    const root = list.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(":scope > li"))
      .map((li) => li.querySelector<HTMLElement>("[data-roving-item]") ?? li.querySelector<HTMLElement>("a,button"))
      .filter((x): x is HTMLElement => !!x);
  }

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % all.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + all.length) % all.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = all.length - 1;
    if (j >= 0) {
      e.preventDefault();
      all[j]?.focus();
    }
  }

  return (
    <ul ref={list} className={["ks-card-case", className].filter(Boolean).join(" ")} aria-label={label} onKeyDown={onKeyDown}>
      {Children.toArray(children).map((child, i) => (
        <li key={i} className="ks-card-case__slot" style={{ "--i": Math.min(i, 8) } as CSSProperties}>
          {child}
        </li>
      ))}
    </ul>
  );
}
