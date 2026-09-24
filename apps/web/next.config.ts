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
};

export default withNextIntl(nextConfig);
