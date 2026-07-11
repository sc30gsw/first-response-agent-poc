import { defineConfig } from "drizzle-kit";
import { resolveDatabaseCredentials } from "./server/db/config";

const credentials = resolveDatabaseCredentials();

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations/sqlite",
  dialect: "turso",
  dbCredentials: credentials,
});
