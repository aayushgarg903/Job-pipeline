// Shared, server-safe preference constants (not in a "use client" module, so server
// components receive real strings rather than client references).
export const LOCALE_COOKIE = "ks-locale";
export const THEME_COOKIE = "ks-theme";
export type Theme = "daylight" | "boardroom";

/**
 * Inline <head> script: applies the saved theme and locale to <html> before first paint.
 * This keeps the root layout static under Cache Components (no cookies() read for attributes).
 */
export const PREFS_BOOT_SCRIPT = `(function(){try{var c=document.cookie,d=document.documentElement;var t=/(?:^|; )${THEME_COOKIE}=(boardroom|daylight)/.exec(c);if(t&&t[1]==="boardroom")d.setAttribute("data-theme","boardroom");var l=/(?:^|; )${LOCALE_COOKIE}=(en|mr)/.exec(c);if(l)d.lang=l[1];}catch(e){}})();`;
