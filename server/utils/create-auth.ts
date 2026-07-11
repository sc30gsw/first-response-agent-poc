import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { threads } from "../db/schema/threads";

/** Anonymous session lifetime in seconds. */
const SESSION_TTL_SECONDS = 60 * 60 * 24;

type CreateAuthOptions<TSchema extends Record<string, unknown>> = {
  db: LibSQLDatabase<TSchema>;
  schema: Record<string, unknown>;
  baseURL?: string;
  secret?: string;
  trustedOrigins?: string[];
  /** Whether email/password auth is available. The PoC defaults to anonymous-only. */
  allowEmailPassword?: boolean;
};

/**
 * Creates the same Better Auth configuration for runtime libSQL and in-memory tests.
 */
export function createAuth<TSchema extends Record<string, unknown>>(
  options: CreateAuthOptions<TSchema>,
) {
  const { db } = options;

  return betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: options.schema,
    }),
    emailAndPassword: {
      enabled: options.allowEmailPassword ?? false,
    },
    plugins: [anonymous()],
    session: {
      expiresIn: SESSION_TTL_SECONDS,
    },
    rateLimit: {
      // Better Auth enables this only in production by default, so enable it explicitly.
      enabled: true,
      storage: "memory",
    },
    databaseHooks: {
      user: {
        delete: {
          before: async (user) => {
            // Delete related threads even when a local SQLite connection does not enforce FKs.
            await db.delete(threads).where(eq(threads.userId, user.id));
          },
        },
      },
    },
  });
}
