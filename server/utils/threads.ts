import { and, count, desc, eq } from "drizzle-orm";
import { Result } from "better-result";
import type { ThreadRecord, ThreadState, ThreadSummary } from "@/shared/types/thread";
import { ThreadStateSchema } from "@/shared/eve-events";
import { normalizeThreadSummary, truncateThreadTitle } from "@/shared/types/thread";
import { db, type AppDatabase } from "../db/client";
import { threads } from "../db/schema/threads";
import { revokeEveSessionsForThread } from "./eve-sessions";

const LIST_LIMIT = 50;
export const MAX_THREADS_PER_USER = 25;

export class ThreadLimitExceededError extends Error {
  constructor() {
    super("Thread limit exceeded");
    this.name = "ThreadLimitExceededError";
  }
}

export class StaleThreadStateError extends Error {
  constructor() {
    super("Thread state is stale");
    this.name = "StaleThreadStateError";
  }
}

function parseThreadState(value: string | null): ThreadState | null {
  if (!value) return null;

  const json = Result.try(() => JSON.parse(value) as unknown);
  if (Result.isError(json)) return null;

  const parsed = ThreadStateSchema.safeParse(json.value);
  return parsed.success ? parsed.data : null;
}

function serializeThreadState(state: ThreadState | undefined) {
  return state ? JSON.stringify(state) : null;
}

function mergeThreadState(existing: ThreadState | null, incoming: ThreadState): ThreadState {
  const session = incoming.session;

  return {
    session: {
      sessionId: session.sessionId ?? existing?.session.sessionId,
      continuationToken: session.continuationToken ?? existing?.session.continuationToken,
      streamIndex: session.streamIndex,
    },
    events: incoming.events,
  };
}

function rowToSummary(row: typeof threads.$inferSelect): ThreadSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    revision: row.stateVersion,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

function rowToRecord(row: typeof threads.$inferSelect): ThreadRecord {
  return {
    ...rowToSummary(row),
    state: parseThreadState(row.state),
  };
}

export async function listThreadsForUser(
  userId: string,
  database: AppDatabase = db,
): Promise<ThreadSummary[]> {
  const rows = await database.select()
    .from(threads)
    .where(eq(threads.userId, userId))
    .orderBy(desc(threads.updatedAt))
    .limit(LIST_LIMIT);

  return rows.map(rowToSummary);
}

export async function getThreadForUser(
  userId: string,
  id: string,
  database: AppDatabase = db,
) {
  const [row] = await database.select()
    .from(threads)
    .where(and(
      eq(threads.id, id),
      eq(threads.userId, userId),
    ))
    .limit(1);

  return row ? rowToRecord(row) : undefined;
}

export async function createThreadForUser(
  userId: string,
  input: { title?: string; summary?: string },
  database: AppDatabase = db,
) {
  const [total] = await database.select({ value: count() })
    .from(threads)
    .where(eq(threads.userId, userId));
  if ((total?.value ?? 0) >= MAX_THREADS_PER_USER) {
    throw new ThreadLimitExceededError();
  }

  const id = crypto.randomUUID();
  const title = input.title?.trim() || "新しい相談";

  await database.insert(threads).values({
    id,
    userId,
    title: truncateThreadTitle(title),
    summary: normalizeThreadSummary(input.summary ?? ""),
  });

  const created = await getThreadForUser(userId, id, database);
  if (!created) {
    throw new Error("Failed to create thread");
  }

  return created;
}

export async function updateThreadForUser(
  userId: string,
  id: string,
  patch: {
    title?: string;
    state?: ThreadState;
  },
  expectedRevision: number,
  database: AppDatabase = db,
) {
  const existing = await getThreadForUser(userId, id, database);
  if (!existing) {
    return undefined;
  }

  const [updated] = await database.update(threads)
    .set({
      stateVersion: expectedRevision + 1,
      updatedAt: new Date(),
      ...(patch.title !== undefined ? { title: truncateThreadTitle(patch.title) } : {}),
      ...(patch.state !== undefined
        ? { state: serializeThreadState(mergeThreadState(existing.state, patch.state)) }
        : {}),
    })
    .where(and(
      eq(threads.id, id),
      eq(threads.userId, userId),
      eq(threads.stateVersion, expectedRevision),
    ))
    .returning({ id: threads.id });

  if (!updated) {
    throw new StaleThreadStateError();
  }

  return getThreadForUser(userId, id, database);
}

export async function deleteThreadForUser(
  userId: string,
  id: string,
  database: AppDatabase = db,
) {
  const [deleted] = await database.delete(threads)
    .where(and(
      eq(threads.id, id),
      eq(threads.userId, userId),
    ))
    .returning({ id: threads.id });
  if (!deleted) return false;

  await revokeEveSessionsForThread(userId, id, database);

  return true;
}
