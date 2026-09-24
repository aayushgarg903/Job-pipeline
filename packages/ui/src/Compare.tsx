"use client";
// Compare-on-the-Table state. The URL is the source of truth: ?table=course:123,course:456
// so a comparison can be shared as a link. Uses the History API directly (Next.js syncs
// useSearchParams with native pushState/replaceState), keeping @ks/ui free of `next`.
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode,
} from "react";
import { parseTable, type CompareItem } from "./compareCore";
import { fill } from "./format";

export type { CompareField, CompareItem } from "./compareCore";

export interface CompareLabels {
  placed: string; // "{name} is on the table. {n} of {max}."
  removed: string; // "{name} taken off the table."
  full: string; // "The table holds {max} cards. Take one off first."
}

export const COMPARE_LABELS_EN: CompareLabels = {
  placed: "{name} is on the table. {n} of {max}.",
  removed: "{name} taken off the table.",
  full: "The table holds {max} cards. Take one off first.",
};

interface CompareCtx {
  refs: string[];
  max: number;
  items: Map<string, CompareItem>;
  has: (ref: string) => boolean;
  toggle: (ref: string, name?: string) => void;
  remove: (ref: string) => void;
  clear: () => void;
  register: (item: CompareItem) => void;
  tableOpen: boolean;
  setTableOpen: (v: boolean) => void;
  announce: (msg: string) => void;
}

const Ctx = createContext<CompareCtx | null>(null);
const EVT = "ks:table";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVT, cb);
  };
}
const getSnapshot = (param: string) => () => new URLSearchParams(window.location.search).get(param) ?? "";
const getServerSnapshot = () => "";

export interface CompareProviderProps {
  children: ReactNode;
  max?: number;
  param?: string;
  labels?: Partial<CompareLabels>;
}

export function CompareProvider({ children, max = 4, param = "table", labels }: CompareProviderProps) {
  const L = { ...COMPARE_LABELS_EN, ...labels };
  const raw = useSyncExternalStore(subscribe, getSnapshot(param), getServerSnapshot);
  const refs = useMemo(() => parseTable(raw, max), [raw, max]);
  const [items, setItems] = useState<Map<string, CompareItem>>(() => new Map());
  const [tableOpen, setTableOpen] = useState(false);
  const [message, setMessage] = useState("");
  const refsRef = useRef(refs);
  refsRef.current = refs;

  const write = useCallback(
    (next: string[]) => {
      const url = new URL(window.location.href);
      if (next.length) url.searchParams.set(param, next.join(","));
      else url.searchParams.delete(param);
      // Keep the comma readable in shared links.
      const search = url.searchParams.toString().replace(/%2C/gi, ",").replace(/%3A/gi, ":");
      window.history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
      window.dispatchEvent(new Event(EVT));
    },
    [param],
  );

  const nameOf = useCallback((ref: string, fallback?: string) => fallback ?? items.get(ref)?.name ?? ref, [items]);

  const toggle = useCallback(
    (ref: string, name?: string) => {
      const cur = refsRef.current;
      if (cur.includes(ref)) {
        write(cur.filter((r) => r !== ref));
        setMessage(fill(L.removed, { name: nameOf(ref, name) }));
      } else if (cur.length >= max) {
        setMessage(fill(L.full, { max }));
      } else {
        write([...cur, ref]);
        setMessage(fill(L.placed, { name: nameOf(ref, name), n: cur.length + 1, max }));
      }
    },
    [write, max, nameOf, L.removed, L.full, L.placed],
  );

  const remove = useCallback(
    (ref: string) => {
      write(refsRef.current.filter((r) => r !== ref));
      setMessage(fill(L.removed, { name: nameOf(ref) }));
    },
    [write, nameOf, L.removed],
  );

  const register = useCallback((item: CompareItem) => {
    setItems((prev) => {
      const old = prev.get(item.ref);
      if (old && JSON.stringify(old) === JSON.stringify(item)) return prev;
      const next = new Map(prev);
      next.set(item.ref, item);
      return next;
    });
  }, []);

  // Keyboard: T places the focused card on the table; with no card focused it opens the table.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "t" && e.key !== "T") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (t?.closest("dialog")) return;
      const host = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-table-ref]");
      if (host?.dataset.tableRef) {
        e.preventDefault();
        toggle(host.dataset.tableRef, host.dataset.tableName);
      } else if (refsRef.current.length) {
        e.preventDefault();
        setTableOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo<CompareCtx>(
    () => ({
      refs, max, items, has: (r) => refs.includes(r), toggle, remove, clear: () => write([]), register,
      tableOpen, setTableOpen, announce: setMessage,
    }),
    [refs, max, items, toggle, remove, write, register, tableOpen],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="ks-live" role="status" aria-live="polite">
        {message}
      </div>
    </Ctx.Provider>
  );
}

export function useCompare(): CompareCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCompare must be used inside <CompareProvider>");
  return c;
}

/** Safe variant for components that should render without a provider (e.g. static galleries). */
export function useOptionalCompare(): CompareCtx | null {
  return useContext(Ctx);
}
