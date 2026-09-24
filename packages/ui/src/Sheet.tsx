"use client";
// Sheet built on the native modal <dialog>: focus trap, Esc, inert background and focus
// return come from the platform. Slides from the right (drawer), left (menu) or bottom (table).
import clsx from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  side?: "right" | "left" | "bottom";
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
  /** lang attribute for the sheet's content when it differs from the page. */
  lang?: string;
}

export function Sheet({ open, onClose, title, description, side = "right", children, footer, closeLabel = "Close", className, lang }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute("open", "");
      }
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={clsx("ks-sheet", `ks-sheet--${side}`, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      lang={lang}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open ? (
        <>
          <header className="ks-sheet__head">
            <div>
              <h2 id={titleId} className="ks-sheet__title">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="ks-sheet__desc">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" className="ks-sheet__close" onClick={onClose} aria-label={closeLabel}>
              <Icon name="x" size={20} />
            </button>
          </header>
          <div className="ks-sheet__body">{children}</div>
          {footer ? <footer className="ks-sheet__foot">{footer}</footer> : null}
        </>
      ) : null}
    </dialog>
  );
}
