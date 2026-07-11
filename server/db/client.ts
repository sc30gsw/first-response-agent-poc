import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { resolveDatabaseCredentials } from "./config";
import * as schema from "./schema";

const globalDatabase = globalThis as typeof globalThis & {
  firstResponseLibsqlClient?: Client;
};

export const client = globalDatabase.firstResponseLibsqlClient
  ?? createClient(resolveDatabaseCredentials());

if (process.env.NODE_ENV !== "production") {
  globalDatabase.firstResponseLibsqlClient = client;
}

export const db = drizzle(client, { schema });
