import { z } from "zod";
import { ThreadStateSchema } from "../eve-events";

export const ThreadSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  summary: z.string().max(280),
  revision: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
});
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

export type ThreadState = z.infer<typeof ThreadStateSchema>;

export const ThreadRecordSchema = ThreadSummarySchema.extend({
  state: ThreadStateSchema.nullable(),
});
export type ThreadRecord = z.infer<typeof ThreadRecordSchema>;

export const ThreadResponseSchema = z.object({ thread: ThreadRecordSchema });

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
