import { z } from "zod";
import { ThreadResponseSchema, ThreadSummarySchema } from "@/shared/types/thread";
import { createThreadBodySchema, patchThreadBodySchema, threadIdParamsSchema } from "../schemas/threads";

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "conflict",
      "database_error",
      "forbidden",
      "limit_exceeded",
      "not_found",
      "unauthorized",
      "validation_error",
    ]),
    message: z.string(),
  }),
});

export const threadApiSchemas = {
  createBody: createThreadBodySchema,
  deleteResponse: z.object({ ok: z.literal(true) }),
  error: apiErrorSchema,
  ifMatchHeaders: z.looseObject({
    "if-match": z.string()
      .describe("Quoted thread revision, for example \"2\"."),
  }),
  itemParams: threadIdParamsSchema,
  listResponse: z.object({ threads: z.array(ThreadSummarySchema) }),
  patchBody: patchThreadBodySchema,
  threadResponse: ThreadResponseSchema,
} as const satisfies Record<string, z.ZodType>;

export const threadErrorResponses = {
  400: threadApiSchemas.error,
  401: threadApiSchemas.error,
  403: threadApiSchemas.error,
  404: threadApiSchemas.error,
  409: threadApiSchemas.error,
  413: threadApiSchemas.error,
  415: threadApiSchemas.error,
  428: threadApiSchemas.error,
  429: threadApiSchemas.error,
  500: threadApiSchemas.error,
} as const satisfies Record<number, z.ZodType>;
