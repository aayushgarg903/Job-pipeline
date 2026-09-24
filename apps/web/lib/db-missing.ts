// Stand-in for @ks/db while that package is being built. next.config.ts aliases
// "@ks/db" here only when packages/db/src/index.ts does not exist.
export const readers = undefined;
export const __missing = true;
