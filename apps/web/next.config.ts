import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// @ks/db is built in parallel. Until its entry exists, alias it to a stub so the bundle
// resolves; lib/readers.ts then falls back to fixtures with a warning.
const dbEntry = resolve(process.cwd(), "../../packages/db/src/index.ts");
const hasDb = existsSync(dbEntry);

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@ks/ui", "@ks/contracts", "@ks/core", "@ks/db", "@ks/ai"],
  serverExternalPackages: ["postgres", "highs"],
  turbopack: {
    resolveAlias: hasDb ? {} : { "@ks/db": "./lib/db-missing.ts" },
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  // Inline scripts stay allowed: Next streams `self.__next_f.push` inline, and a nonce CSP would
  // force every page dynamic and lose the Cache Components static shell. Everything else is strict.
  async headers() {
    const dev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self'${dev ? " ws:" : ""}`,
      "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
      ...(dev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default withNextIntl(nextConfig);
