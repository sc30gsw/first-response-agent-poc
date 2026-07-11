import { z } from "zod";
import { ThreadStateSchema } from "@/shared/eve-events";

export const threadIdParamsSchema = z.object({
  id: z.string().trim().uuid("Thread id must be a UUID"),
});

export const createThreadBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(280).optional(),
});

export const threadStateSchema = ThreadStateSchema;

export const patchThreadBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  state: threadStateSchema.optional(),
}).refine(
  (value) => value.title !== undefined || value.state !== undefined,
  "At least one patch field is required",
);
