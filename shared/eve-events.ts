import type { HandleMessageStreamEvent, InputResponse } from "eve/client";
import { z } from "zod";

const jsonValueSchema = z.json();
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
export const EveSessionIdSchema = z.string().trim().min(1).max(256);
export type EveSessionId = z.output<typeof EveSessionIdSchema>;
export type EveInputSelection = Readonly<
  Required<Pick<InputResponse, "optionId" | "requestId">>
>;
export type EveInputResponder = (
  requestId: EveInputSelection["requestId"],
  optionId: EveInputSelection["optionId"],
) => Promise<void>;
const metaShape = {
  meta: z.object({ at: z.string().min(1) }).optional(),
};
const turnCoordinatesShape = {
  sequence: z.number().int().nonnegative(),
  turnId: z.string().min(1),
};
const stepCoordinatesShape = {
  ...turnCoordinatesShape,
  stepIndex: z.number().int().nonnegative(),
};
const finishReasonSchema = z.enum([
  "content-filter",
  "error",
  "length",
  "other",
  "stop",
  "tool-calls",
]);

const runtimeActionRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    callId: z.string().min(1),
    input: jsonObjectSchema,
    kind: z.literal("load-skill"),
  }),
  z.object({
    callId: z.string().min(1),
    input: jsonObjectSchema,
    kind: z.literal("tool-call"),
    toolName: z.string().min(1),
  }),
]);

const runtimeActionResultSchema = z.discriminatedUnion("kind", [
  z.object({
    callId: z.string().min(1),
    isError: z.boolean().optional(),
    kind: z.literal("load-skill-result"),
    name: z.string().optional(),
    output: jsonValueSchema,
  }),
  z.object({
    callId: z.string().min(1),
    isError: z.boolean().optional(),
    kind: z.literal("tool-result"),
    output: jsonValueSchema,
    toolName: z.string().min(1),
  }),
]);

const inputOptionSchema = z.object({
  description: z.string().optional(),
  id: z.string().min(1),
  label: z.string().min(1),
  style: z.enum(["danger", "default", "primary"]).optional(),
});

const inputRequestSchema = z.object({
  action: z.object({
    callId: z.string().min(1),
    input: jsonObjectSchema,
    kind: z.literal("tool-call"),
    toolName: z.string().min(1),
  }),
  allowFreeform: z.boolean().optional(),
  display: z.enum(["confirmation", "select", "text"]).optional(),
  options: z.array(inputOptionSchema).optional(),
  prompt: z.string(),
  requestId: z.string().min(1),
});

export const PersistedEveEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.started"),
    data: z.object({
      runtime: z.object({
        agentId: z.string(),
        agentName: z.string().optional(),
        eveVersion: z.string(),
        build: z.object({
          deployedAt: z.string().optional(),
          gitBranch: z.string().optional(),
          gitSha: z.string().optional(),
        }).optional(),
        modelId: z.string(),
      }).optional(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("turn.started"),
    data: z.object(turnCoordinatesShape),
    ...metaShape,
  }),
  z.object({
    type: z.literal("message.received"),
    data: z.object({
      ...turnCoordinatesShape,
      message: z.string(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("actions.requested"),
    data: z.object({
      ...stepCoordinatesShape,
      actions: z.array(runtimeActionRequestSchema),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("input.requested"),
    data: z.object({
      ...stepCoordinatesShape,
      requests: z.array(inputRequestSchema),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("action.result"),
    data: z.object({
      ...stepCoordinatesShape,
      error: z.object({ code: z.string(), message: z.string() }).optional(),
      result: runtimeActionResultSchema,
      status: z.enum(["completed", "failed", "rejected"]),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("message.appended"),
    data: z.object({
      ...stepCoordinatesShape,
      messageDelta: z.string(),
      messageSoFar: z.string(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("message.completed"),
    data: z.object({
      ...stepCoordinatesShape,
      finishReason: finishReasonSchema,
      message: z.string().nullable(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("reasoning.appended"),
    data: z.object({
      ...stepCoordinatesShape,
      reasoningDelta: z.string(),
      reasoningSoFar: z.string(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("reasoning.completed"),
    data: z.object({
      ...stepCoordinatesShape,
      reasoning: z.string(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("result.completed"),
    data: z.object({
      ...stepCoordinatesShape,
      result: jsonValueSchema,
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("step.started"),
    data: z.object(stepCoordinatesShape),
    ...metaShape,
  }),
  z.object({
    type: z.literal("step.completed"),
    data: z.object({
      ...stepCoordinatesShape,
      finishReason: finishReasonSchema,
      providerMetadata: z.object({
        gateway: z.object({ generationId: z.string() }),
      }).optional(),
      usage: z.object({
        costUsd: z.number().optional(),
        inputTokens: z.number().optional(),
        outputTokens: z.number().optional(),
        cacheReadTokens: z.number().optional(),
        cacheWriteTokens: z.number().optional(),
      }).optional(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("step.failed"),
    data: z.object({
      ...stepCoordinatesShape,
      code: z.string(),
      details: jsonObjectSchema.optional(),
      message: z.string(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("turn.completed"),
    data: z.object(turnCoordinatesShape),
    ...metaShape,
  }),
  z.object({
    type: z.literal("turn.failed"),
    data: z.object({
      ...turnCoordinatesShape,
      code: z.string(),
      details: jsonObjectSchema.optional(),
      message: z.string(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("compaction.requested"),
    data: z.object({
      ...turnCoordinatesShape,
      modelId: z.string(),
      sessionId: EveSessionIdSchema,
      usageInputTokens: z.number().nullable(),
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("compaction.completed"),
    data: z.object({
      ...turnCoordinatesShape,
      modelId: z.string(),
      sessionId: EveSessionIdSchema,
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("session.waiting"),
    data: z.object({ wait: z.literal("next-user-message") }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("session.failed"),
    data: z.object({
      code: z.string(),
      details: jsonObjectSchema.optional(),
      message: z.string(),
      sessionId: EveSessionIdSchema,
    }),
    ...metaShape,
  }),
  z.object({
    type: z.literal("session.completed"),
    ...metaShape,
  }),
]);

export const PersistedEveEventsSchema = z.array(PersistedEveEventSchema);

export const ThreadStateSchema = z.object({
  session: z.object({
    sessionId: EveSessionIdSchema.optional(),
    continuationToken: z.string().trim().min(1).optional(),
    streamIndex: z.number().int().nonnegative(),
  }),
  events: PersistedEveEventsSchema.max(1_000),
});

export function parsePersistedEveEvents(value: unknown): readonly HandleMessageStreamEvent[] {
  return PersistedEveEventsSchema.parse(value);
}
