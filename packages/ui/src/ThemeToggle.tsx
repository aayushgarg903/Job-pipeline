"use client";
// Daylight (default, used for projection and print) / Boardroom (opt-in). Pure CSS switch:
// sets data-theme on <html> and a cookie the app's inline head script reads before paint.
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { THEME_COOKIE, type Theme } from "./prefs";

export interface ThemeToggleProps {
  labels?: { group?: string; daylight?: string; boardroom?: string };
}

export function ThemeToggle({ labels }: ThemeToggleProps) {
  const L = { group: "Theme", daylight: "Daylight", boardroom: "Boardroom", ...labels };
  const [theme, setTheme] = useState<Theme>("daylight");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "boardroom" ? "boardroom" : "daylight");
  }, []);
  function pick(t: Theme) {
    setTheme(t);
    const d = document.documentElement;
    if (t === "boardroom") d.setAttribute("data-theme", "boardroom");
    else d.removeAttribute("data-theme");
    try {
      document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked: theme still applies for this page */
    }
  }
  return (
    <div className="ks-seg" role="group" aria-label={L.group}>
      <button type="button" className="ks-seg__btn" aria-pressed={theme === "daylight"} onClick={() => pick("daylight")}>
        <Icon name="sun" size={16} />
        <span className="sr-only">{L.daylight}</span>
      </button>
      <button type="button" className="ks-seg__btn" aria-pressed={theme === "boardroom"} onClick={() => pick("boardroom")}>
        <Icon name="moon" size={16} />
        <span className="sr-only">{L.boardroom}</span>
      </button>
    </div>
  );
}
