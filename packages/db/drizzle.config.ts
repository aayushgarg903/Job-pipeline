import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: process.env.KS_ENV ?? "../../.env", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  schemaFilter: ["ks"],
  dbCredentials: { url: process.env.DATABASE_URL_SESSION ?? "" },
});
