import { mkdirSync } from "node:fs";

const LOCAL_DATABASE_URL = "file:.data/db.sqlite";

export function resolveDatabaseCredentials(environment: NodeJS.ProcessEnv = process.env) {
  const url = environment.TURSO_DATABASE_URL?.trim()
    || environment.TURSO_URL?.trim();
  const authToken = environment.TURSO_AUTH_TOKEN?.trim();

  if (url) {
    if (url.startsWith("libsql://") && !authToken) {
      throw new Error("TURSO_AUTH_TOKEN is required for a remote libSQL database.");
    }

    return { url, authToken };
  }

  if (environment.VERCEL) {
    throw new Error("TURSO_DATABASE_URL or TURSO_URL is required on Vercel.");
  }

  mkdirSync(".data", { recursive: true });
  return { url: LOCAL_DATABASE_URL };
}
