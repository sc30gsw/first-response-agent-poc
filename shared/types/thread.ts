import { z } from "zod";
import type { Thread } from "@/server/db/schema/threads";
import { ThreadStateSchema } from "../eve-events";

type ThreadSummaryRow = Pick<
  Thread,
  "createdAt" | "id" | "stateVersion" | "summary" | "title" | "updatedAt"
>;
type SerializedThreadTimestamp = ReturnType<Thread["createdAt"]["getTime"]>;

export type ThreadId = Thread["id"];
type ThreadSummaryFromStorage = Readonly<
  Omit<ThreadSummaryRow, "createdAt" | "stateVersion" | "updatedAt">
  & {
    readonly createdAt: SerializedThreadTimestamp;
    readonly revision: ThreadSummaryRow["stateVersion"];
    readonly updatedAt: SerializedThreadTimestamp;
  }
>;

export const ThreadIdSchema = z.string().trim().uuid("Thread id must be a UUID");
export const ThreadTitleSchema = z.string().trim().min(1).max(200);
export const ThreadSummaryTextSchema = z.string().trim().max(280);

export const ThreadSummarySchema = z.object({
  id: ThreadIdSchema,
  title: ThreadTitleSchema,
  summary: ThreadSummaryTextSchema,
  revision: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
});
export type ThreadSummary = Readonly<z.output<typeof ThreadSummarySchema>>;

type _ThreadSummaryStorageContract = ThreadSummary extends ThreadSummaryFromStorage
  ? ThreadSummaryFromStorage extends ThreadSummary
    ? true
    : never
  : never;
const threadSummaryStorageContract = true satisfies _ThreadSummaryStorageContract;
void threadSummaryStorageContract;

export type ThreadState = z.output<typeof ThreadStateSchema>;

export const ThreadRecordSchema = ThreadSummarySchema.extend({
  state: ThreadStateSchema.nullable(),
});
export type ThreadRecord = Readonly<z.output<typeof ThreadRecordSchema>>;

export const ThreadResponseSchema = z.object({
  thread: ThreadRecordSchema,
});
export type ThreadResponse = z.output<typeof ThreadResponseSchema>;

export function threadRecordToSummary({
  state: _state,
  ...summary
}: ThreadRecord): ThreadSummary {
  return summary;
}

export function truncateThreadTitle(text: string, maxLength = 60): string {
  const line = text.trim().split("\n")[0]?.trim() || "新しい相談";
  if (line.length <= maxLength) {
    return line;
  }

  return `${line.slice(0, maxLength - 1)}…`;
}

export function normalizeThreadSummary(text: string, maxLength = 280): string {
  const normalized = text.trim().replace(/\s+/gu, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}
