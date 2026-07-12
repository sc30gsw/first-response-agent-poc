import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { EveSessionId } from "@/shared/eve-events";
import type { User } from "./auth";
import type { Thread } from "./threads";

export const rateLimit = sqliteTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

export const agentRateLimits = sqliteTable("agent_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const agentRunLeases = sqliteTable("agent_run_leases", {
  subjectKey: text("subject_key").primaryKey(),
  leaseId: text("lease_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const eveSessionBindings = sqliteTable("eve_session_bindings", {
  sessionId: text("session_id").$type<EveSessionId>().primaryKey(),
  userId: text("user_id").$type<User["id"]>().notNull(),
  threadId: text("thread_id").$type<Thread["id"]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  purgeRequestedAt: integer("purge_requested_at", { mode: "timestamp_ms" }),
  purgedAt: integer("purged_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("eve_session_bindings_user_idx").on(table.userId),
  index("eve_session_bindings_thread_idx").on(table.threadId),
]);

export type AgentRunLease = typeof agentRunLeases.$inferSelect;
export type EveSessionBinding = typeof eveSessionBindings.$inferSelect;
