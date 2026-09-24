// next-intl without route prefixes: locale comes from the `ks-locale` cookie, then the
// browser's Accept-Language (Marathi by default when the browser asks for mr).
// Reading cookies()/headers() makes this request-bound, so every translated subtree is
// rendered inside the root layout's <Suspense>, never inside a "use cache" scope.
import type { Lang } from "@ks/contracts";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE } from "@ks/ui";

export const LOCALES: Lang[] = ["en", "mr"];

export async function resolveLocale(): Promise<Lang> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (c === "en" || c === "mr") return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^\s*mr\b/i.test(accept) ? "mr" : "en";
}

export default getRequestConfig(async ({ locale: explicit }) => {
  // An explicit locale (getTranslations({ locale: "mr" })) wins; otherwise cookie / header.
  const locale: Lang = explicit === "en" || explicit === "mr" ? explicit : await resolveLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: "Asia/Kolkata" };
});
