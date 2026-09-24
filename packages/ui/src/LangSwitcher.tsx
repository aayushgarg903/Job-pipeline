"use client";
// EN / मराठी. Writes the `ks-locale` cookie, updates <html lang> at once, then asks the app to
// re-render (router.refresh via onChange; full reload if none is given).
import type { Lang } from "@ks/contracts";
import { useState, useTransition } from "react";
import { LOCALE_COOKIE } from "./prefs";

export interface LangSwitcherProps {
  current: Lang;
  onChange?: (lang: Lang) => void;
  label?: string;
  className?: string;
}

const OPTIONS: Array<{ lang: Lang; text: string; name: string }> = [
  { lang: "en", text: "EN", name: "English" },
  { lang: "mr", text: "मराठी", name: "मराठी" },
];

export function setLocaleCookie(lang: Lang) {
  document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = lang;
}

export function LangSwitcher({ current, onChange, label = "Language / भाषा", className }: LangSwitcherProps) {
  const [shown, setShown] = useState<Lang>(current);
  const [pending, start] = useTransition();
  function pick(l: Lang) {
    if (l === shown) return;
    setShown(l);
    setLocaleCookie(l);
    start(() => {
      if (onChange) onChange(l);
      else window.location.reload();
    });
  }
  return (
    <div className={["ks-seg", className].filter(Boolean).join(" ")} role="group" aria-label={label} aria-busy={pending || undefined}>
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          className="ks-seg__btn"
          lang={o.lang}
          aria-pressed={shown === o.lang}
          aria-label={o.name}
          onClick={() => pick(o.lang)}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}
