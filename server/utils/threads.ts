import { and, count, desc, eq } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import type { ThreadRecord, ThreadState, ThreadSummary } from "@/shared/types/thread";
import { ThreadStateSchema } from "@/shared/eve-events";
import { normalizeThreadSummary, truncateThreadTitle } from "@/shared/types/thread";
import { db, type AppDatabase } from "../db/client";
import { threads, type Thread, type ThreadInsert } from "../db/schema/threads";
import { revokeEveSessionsForThread } from "./eve-sessions";

const LIST_LIMIT = 50;
export const MAX_THREADS_PER_USER = 25;

export class ThreadStateParseError extends TaggedError("ThreadStateParseError")<{
  readonly cause: unknown;
  readonly message: string;
  readonly reason: "invalid-json" | "invalid-shape";
  readonly threadId: Thread["id"];
}>() {}

export class ThreadLimitExceededError extends TaggedError("ThreadLimitExceededError")<{
  readonly message: string;
}>() {}

export class StaleThreadStateError extends TaggedError("StaleThreadStateError")<{
  readonly message: string;
  readonly threadId: Thread["id"];
}>() {}

export type ThreadRepositoryError =
  | StaleThreadStateError
  | ThreadLimitExceededError
  | ThreadStateParseError;

function parseThreadState(
  threadId: Thread["id"],
  value: Thread["state"],
): Result<ThreadState | null, ThreadStateParseError> {
  if (!value) return Result.ok(null);

  const json = Result.try({
    try: () => JSON.parse(value) as unknown,
    catch: cause => new ThreadStateParseError({
      cause,
      message: "Stored thread state is not valid JSON",
      reason: "invalid-json",
      threadId,
    }),
  });
  if (Result.isError(json)) return Result.err(json.error);

  const parsed = ThreadStateSchema.safeParse(json.value);
  return parsed.success
    ? Result.ok(parsed.data)
    : Result.err(new ThreadStateParseError({
        cause: parsed.error,
        message: "Stored thread state has an invalid shape",
        reason: "invalid-shape",
        threadId,
      }));
}

function serializeThreadState(state: ThreadState | undefined): Thread["state"] {
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

function rowToSummary(row: Thread): ThreadSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    revision: row.stateVersion,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

function rowToRecord(row: Thread): Result<ThreadRecord, ThreadStateParseError> {
  const state = parseThreadState(row.id, row.state);
  if (Result.isError(state)) return Result.err(state.error);

  return Result.ok({
    ...rowToSummary(row),
    state: state.value,
  });
}

export async function listThreadsForUser(
  userId: Thread["userId"],
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
  userId: Thread["userId"],
  id: Thread["id"],
  database: AppDatabase = db,
): Promise<Result<ThreadRecord | undefined, ThreadStateParseError>> {
  const [row] = await database.select()
    .from(threads)
    .where(and(
      eq(threads.id, id),
      eq(threads.userId, userId),
    ))
    .limit(1);

  return row ? rowToRecord(row) : Result.ok(undefined);
}

export async function createThreadForUser(
  userId: Thread["userId"],
  input: Partial<Pick<ThreadInsert, "title" | "summary">>,
  database: AppDatabase = db,
): Promise<Result<ThreadRecord, ThreadLimitExceededError | ThreadStateParseError>> {
  const [total] = await database.select({ value: count() })
    .from(threads)
    .where(eq(threads.userId, userId));
  if ((total?.value ?? 0) >= MAX_THREADS_PER_USER) {
    return Result.err(new ThreadLimitExceededError({
      message: "Thread limit exceeded",
    }));
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
  if (Result.isError(created)) return Result.err(created.error);
  if (!created.value) {
    throw new Error("Failed to create thread");
  }

  return Result.ok(created.value);
}

export async function updateThreadForUser(
  userId: Thread["userId"],
  id: Thread["id"],
  patch: Partial<Pick<Thread, "title">> & { readonly state?: ThreadState },
  expectedRevision: Thread["stateVersion"],
  database: AppDatabase = db,
): Promise<Result<ThreadRecord | undefined, ThreadStateParseError | StaleThreadStateError>> {
  const existing = await getThreadForUser(userId, id, database);
  if (Result.isError(existing)) return Result.err(existing.error);
  if (!existing.value) return Result.ok(undefined);

  const [updated] = await database.update(threads)
    .set({
      stateVersion: expectedRevision + 1,
      updatedAt: new Date(),
      ...(patch.title !== undefined ? { title: truncateThreadTitle(patch.title) } : {}),
      ...(patch.state !== undefined
        ? { state: serializeThreadState(mergeThreadState(existing.value.state, patch.state)) }
        : {}),
    })
    .where(and(
      eq(threads.id, id),
      eq(threads.userId, userId),
      eq(threads.stateVersion, expectedRevision),
    ))
    .returning({ id: threads.id });

  if (!updated) {
    return Result.err(new StaleThreadStateError({
      message: "Thread state is stale",
      threadId: id,
    }));
  }

  return getThreadForUser(userId, id, database);
}

export async function deleteThreadForUser(
  userId: Thread["userId"],
  id: Thread["id"],
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
