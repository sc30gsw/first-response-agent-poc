import { z } from "zod";
import { ThreadStateSchema } from "@/shared/eve-events";
import {
  ThreadIdSchema,
  ThreadSummaryTextSchema,
  ThreadTitleSchema,
} from "@/shared/types/thread";

export const threadIdParamsSchema = z.object({
  id: ThreadIdSchema,
});
export type ThreadIdParamsInput = z.input<typeof threadIdParamsSchema>;
export type ThreadIdParams = z.output<typeof threadIdParamsSchema>;

export const createThreadBodySchema = z.object({
  title: ThreadTitleSchema.optional(),
  summary: ThreadSummaryTextSchema.optional(),
});
export type CreateThreadInput = z.input<typeof createThreadBodySchema>;
export type CreateThreadData = z.output<typeof createThreadBodySchema>;

export const threadStateSchema = ThreadStateSchema;

export const patchThreadBodySchema = z.object({
  title: ThreadTitleSchema.optional(),
  summary: ThreadSummaryTextSchema.optional(),
  state: threadStateSchema.optional(),
}).refine(
  (value) => value.title !== undefined || value.summary !== undefined || value.state !== undefined,
  "At least one patch field is required",
);
export type PatchThreadInput = z.input<typeof patchThreadBodySchema>;
export type PatchThreadData = z.output<typeof patchThreadBodySchema>;
