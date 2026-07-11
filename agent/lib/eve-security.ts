import { createHmac } from "node:crypto";
import { Result, TaggedError, matchError } from "better-result";
import type { AuthFn } from "eve/channels/auth";
import type { EveChannelEvents } from "eve/channels/eve";
import type { SessionAuthContext } from "eve/context";
import { and, eq, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { MAX_CHAT_MESSAGE_CHARS } from "@/shared/chat-limits";
import { ThreadStateSchema } from "@/shared/eve-events";
import type { AppDatabase } from "@/server/db/client";
import { db } from "@/server/db/client";
import {
  agentRateLimits,
  agentRunLeases,
  eveSessionBindings,
} from "@/server/db/schema/security";
import { threads } from "@/server/db/schema/threads";
import { readJsonBody, validateSameOrigin } from "@/server/utils/http-security";

const threadIdSchema = z.string().trim().uuid();
const eveSessionIdSchema = z.string().min(1).max(256);
const SESSION_ROUTE = /^\/eve\/v1\/session(?:\/([^/]+)(?:\/stream)?)?\/?$/u;
const nonBlankStringSchema = z.string().min(1).refine((value) => value.trim().length > 0);
const textPartSchema = z.object({
  type: z.literal("text"),
  text: nonBlankStringSchema,
});
const inputResponseSchema = z.object({
  requestId: nonBlankStringSchema.max(256),
  optionId: nonBlankStringSchema.max(256).optional(),
  text: nonBlankStringSchema.optional(),
}).refine(
  response => response.optionId !== undefined || response.text !== undefined,
  "An option or text response is required",
);
const turnPayloadSchema = z.looseObject({
  continuationToken: z.string().min(1).optional(),
  inputResponses: z.array(inputResponseSchema).min(1).max(10).optional(),
  message: z.union([
    nonBlankStringSchema,
    z.array(textPartSchema).min(1).max(64),
  ]).optional(),
});
const filePartProbeSchema = z.object({
  message: z.array(z.object({ type: z.unknown() })),
});

export type EveSecurityLimits = {
  readonly userPerMinute: number;
  readonly userPerDay: number;
  readonly ipPerHour: number;
  readonly maxConcurrent: number;
  readonly leaseSeconds: number;
  readonly maxMessageChars: number;
  readonly maxBodyBytes: number;
};

const DEFAULT_LIMITS = {
  userPerMinute: 8,
  userPerDay: 50,
  ipPerHour: 120,
  maxConcurrent: 1,
  leaseSeconds: 180,
  maxMessageChars: MAX_CHAT_MESSAGE_CHARS,
  maxBodyBytes: 32 * 1024,
} as const satisfies EveSecurityLimits;

type AppSession = {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  };
} | null;

type CreateEveSecurityOptions = {
  readonly database?: AppDatabase;
  readonly getSession: (headers: Headers) => Promise<AppSession>;
  readonly secret?: string;
  readonly limits?: Partial<EveSecurityLimits>;
};

class EveHttpError extends Error {
  readonly response: Response;

  constructor(status: number, code: string, message: string, headers?: HeadersInit) {
    super(message);
    this.name = "EveHttpError";
    const responseHeaders = new Headers(headers);
    responseHeaders.set("cache-control", "no-store");
    this.response = Response.json({ code, error: message, ok: false }, {
      headers: responseHeaders,
      status,
    });
  }
}

type EveDatabaseOperation =
  | "acquire-lease"
  | "bind-session"
  | "clean-rate-limits"
  | "consume-rate-limit"
  | "find-session-binding"
  | "find-thread"
  | "release-lease"
  | "revoke-session-binding";

class EveRequestError extends TaggedError("EveRequestError")<{
  readonly cause?: unknown;
  readonly code: string;
  readonly message: string;
  readonly status: 400 | 413 | 415;
}>() {}

class EveAuthorizationError extends TaggedError("EveAuthorizationError")<{
  readonly code: string;
  readonly message: string;
}>() {}

class EveAuthenticationError extends TaggedError("EveAuthenticationError")<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: true;
}>() {}

class EveRateLimitError extends TaggedError("EveRateLimitError")<{
  readonly code: "concurrent_turn_limit" | "rate_limit_exceeded";
  readonly message: string;
  readonly retryAfter: number;
}>() {}

class EveDatabaseError extends TaggedError("EveDatabaseError")<{
  readonly cause: unknown;
  readonly message: string;
  readonly operation: EveDatabaseOperation;
  readonly retryable: true;
}>() {}

class EveThreadStateError extends TaggedError("EveThreadStateError")<{
  readonly cause: unknown;
  readonly message: string;
  readonly operation: "parse-thread-state" | "validate-thread-state";
}>() {}

type EveSecurityError =
  | EveAuthenticationError
  | EveAuthorizationError
  | EveDatabaseError
  | EveRateLimitError
  | EveRequestError
  | EveThreadStateError;

function readAttribute(auth: SessionAuthContext | null, name: string) {
  const value = auth?.attributes[name];
  return typeof value === "string" ? value : null;
}

function sessionIdFromThreadState(
  state: string | null,
): Result<string | null, EveThreadStateError> {
  if (!state) return Result.ok(null);

  const json = Result.try({
    try: () => JSON.parse(state) as unknown,
    catch: cause => new EveThreadStateError({
      cause,
      message: "Stored thread state is not valid JSON",
      operation: "parse-thread-state",
    }),
  });
  if (Result.isError(json)) return Result.err(json.error);

  const parsed = ThreadStateSchema.safeParse(json.value);
  if (!parsed.success) {
    return Result.err(new EveThreadStateError({
      cause: parsed.error,
      message: "Stored thread state has an invalid shape",
      operation: "validate-thread-state",
    }));
  }

  return Result.ok(parsed.data.session.sessionId ?? null);
}

function messageLength(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (!Array.isArray(value)) return 0;

  return value.reduce((total, part) => {
    if (!part || typeof part !== "object") return total;
    const candidate = part as { type?: unknown; text?: unknown };
    return candidate.type === "text" && typeof candidate.text === "string"
      ? total + candidate.text.length
      : total;
  }, 0);
}

function payloadTextLength(payload: z.output<typeof turnPayloadSchema>) {
  return messageLength(payload.message) + (payload.inputResponses?.reduce(
    (total, response) => total + (response.text?.length ?? 0),
    0,
  ) ?? 0);
}

function validateTurnPayload(
  value: unknown,
  requiresContinuationToken: boolean,
): Result<z.output<typeof turnPayloadSchema>, EveRequestError> {
  const fileProbe = filePartProbeSchema.safeParse(value);
  if (fileProbe.success && fileProbe.data.message.some((part) => part.type === "file")) {
    return Result.err(new EveRequestError({
      code: "uploads_disabled",
      message: "File uploads are disabled",
      status: 415,
    }));
  }
  const parsed = turnPayloadSchema.safeParse(value);
  if (!parsed.success) {
    return Result.err(new EveRequestError({
      cause: parsed.error,
      code: "invalid_request",
      message: "Invalid Eve request",
      status: 400,
    }));
  }
  const payload = parsed.data;
  if (requiresContinuationToken) {
    if (!payload.continuationToken) {
      return Result.err(new EveRequestError({
        code: "continuation_required",
        message: "Continuation token is required",
        status: 400,
      }));
    }
    if (!payload.message && !payload.inputResponses) {
      return Result.err(new EveRequestError({
        code: "message_required",
        message: "A message or input response is required",
        status: 400,
      }));
    }
  }
  else if (!payload.message) {
    return Result.err(new EveRequestError({
      code: "message_required",
      message: "A message is required",
      status: 400,
    }));
  }

  return Result.ok(payload);
}

function requestIp(request: Request, userId: string) {
  const raw = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")
    : request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  return raw?.split(",", 1)[0]?.trim() || `missing:${userId}`;
}

function validateThreadId(value: string | null) {
  const parsed = threadIdSchema.safeParse(value);
  return parsed.success
    ? Result.ok(parsed.data)
    : Result.err(new EveAuthorizationError({
        code: "thread_required",
        message: "A valid thread is required",
      }));
}

function decodeEveSessionId(value: string) {
  const decoded = Result.try({
    try: () => decodeURIComponent(value),
    catch: cause => new EveRequestError({
      cause,
      code: "invalid_session_id",
      message: "Invalid Eve session id",
      status: 400,
    }),
  });
  if (Result.isError(decoded)) return Result.err(decoded.error);

  const parsed = eveSessionIdSchema.safeParse(decoded.value);
  return parsed.success
    ? Result.ok(parsed.data)
    : Result.err(new EveRequestError({
        cause: parsed.error,
        code: "invalid_session_id",
        message: "Invalid Eve session id",
        status: 400,
      }));
}

async function readTurnBody(request: Request, maxBodyBytes: number) {
  const cloned = Result.try({
    try: () => request.clone(),
    catch: cause => new EveRequestError({
      cause,
      code: "invalid_request",
      message: "Invalid request body",
      status: 400,
    }),
  });
  if (Result.isError(cloned)) return Result.err(cloned.error);

  const read = await readJsonBody(cloned.value, maxBodyBytes);
  return Result.isOk(read) ? Result.ok(read.value) : Result.err(new EveRequestError({
    cause: read.error,
    code: "invalid_request",
    message: read.error.message,
    status: read.error.status,
  }));
}

function toHttpError(error: EveSecurityError): EveHttpError {
  return matchError(error, {
    EveAuthenticationError: () => new EveHttpError(
      500,
      "authentication_unavailable",
      "Authentication is temporarily unavailable",
    ),
    EveAuthorizationError: value => new EveHttpError(
      403,
      value.code,
      value.message,
    ),
    EveDatabaseError: () => new EveHttpError(
      500,
      "security_state_unavailable",
      "Security state is temporarily unavailable",
    ),
    EveRateLimitError: value => new EveHttpError(
      429,
      value.code,
      value.message,
      { "retry-after": String(value.retryAfter) },
    ),
    EveRequestError: value => new EveHttpError(
      value.status,
      value.code,
      value.message,
    ),
    // Invalid legacy state must fail closed without exposing persistence details.
    EveThreadStateError: () => new EveHttpError(
      403,
      "eve_session_forbidden",
      "Eve session does not belong to this thread",
    ),
  });
}

function toEventError(error: EveSecurityError): Error {
  const message = matchError<EveSecurityError, string>(error, {
    EveAuthenticationError: () => "Eve authentication could not be completed",
    EveAuthorizationError: value => value.message,
    EveDatabaseError: () => "Eve security state could not be persisted",
    EveRateLimitError: value => value.message,
    EveRequestError: value => value.message,
    EveThreadStateError: () => "Stored Eve thread state is invalid",
  });
  return new Error(message);
}

export function createEveSecurity(options: CreateEveSecurityOptions) {
  const database = options.database ?? db;
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  if (limits.maxConcurrent !== 1) {
    throw new Error("Eve security currently requires maxConcurrent to be 1.");
  }
  const secret = options.secret ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for Eve rate-limit keys.");
  }

  const keyedHash = (value: string) => createHmac("sha256", secret)
    .update(value)
    .digest("hex");

  function runDatabase<T>(
    operation: EveDatabaseOperation,
    task: () => Promise<T>,
  ) {
    return Result.tryPromise({
      try: task,
      catch: cause => new EveDatabaseError({
        cause,
        message: "Eve security database operation failed",
        operation,
        retryable: true,
      }),
    });
  }

  async function consumeCounter(
    namespace: string,
    subject: string,
    windowSeconds: number,
    maximum: number,
  ) {
    const now = Date.now();
    const windowMs = windowSeconds * 1_000;
    const bucket = Math.floor(now / windowMs);
    const key = keyedHash(`${namespace}:${subject}:${bucket}`);
    return Result.gen(async function* () {
      const rows = yield* Result.await(runDatabase(
        "consume-rate-limit",
        () => database.insert(agentRateLimits)
          .values({
            key,
            count: 1,
            expiresAt: new Date((bucket + 1) * windowMs),
          })
          .onConflictDoUpdate({
            target: agentRateLimits.key,
            set: { count: sql`${agentRateLimits.count} + 1` },
            setWhere: lt(agentRateLimits.count, maximum),
          })
          .returning({ count: agentRateLimits.count }),
      ));
      if (rows[0]) return Result.ok(undefined);

      const retryAfter = Math.max(
        1,
        Math.ceil(((bucket + 1) * windowMs - now) / 1_000),
      );
      return Result.err(new EveRateLimitError({
        code: "rate_limit_exceeded",
        message: "Too many requests",
        retryAfter,
      }));
    });
  }

  async function acquireLease(userId: string) {
    const now = new Date();
    const leaseId = crypto.randomUUID();
    const subjectKey = keyedHash(`lease:${userId}`);
    const expiresAt = new Date(now.getTime() + limits.leaseSeconds * 1_000);
    return Result.gen(async function* () {
      const rows = yield* Result.await(runDatabase(
        "acquire-lease",
        () => database.insert(agentRunLeases)
          .values({ subjectKey, leaseId, expiresAt })
          .onConflictDoUpdate({
            target: agentRunLeases.subjectKey,
            set: { leaseId, expiresAt },
            setWhere: lte(agentRunLeases.expiresAt, now),
          })
          .returning({ leaseId: agentRunLeases.leaseId }),
      ));
      if (rows[0]) return Result.ok(rows[0].leaseId);

      return Result.err(new EveRateLimitError({
        code: "concurrent_turn_limit",
        message: "Another request is still running",
        retryAfter: limits.leaseSeconds,
      }));
    });
  }

  async function bindSessionResult(
    sessionId: string,
    auth: SessionAuthContext | null,
  ) {
    const threadId = readAttribute(auth, "threadId");
    const userId = auth?.principalId;
    if (!threadId || !userId) {
      return Result.err(new EveAuthorizationError({
        code: "thread_required",
        message: "Eve session binding requires an authenticated thread owner",
      }));
    }

    return Result.gen(async function* () {
      yield* Result.await(runDatabase(
        "bind-session",
        () => database.insert(eveSessionBindings)
          .values({ sessionId, userId, threadId })
          .onConflictDoNothing({ target: eveSessionBindings.sessionId }),
      ));
      const bindings = yield* Result.await(runDatabase(
        "find-session-binding",
        () => database.select()
          .from(eveSessionBindings)
          .where(eq(eveSessionBindings.sessionId, sessionId))
          .limit(1),
      ));
      const binding = bindings[0];
      if (
        !binding
        || binding.revokedAt
        || binding.userId !== userId
        || binding.threadId !== threadId
      ) {
        return Result.err(new EveAuthorizationError({
          code: "eve_session_forbidden",
          message: "Eve session is already bound to another owner",
        }));
      }

      const ownedThreads = yield* Result.await(runDatabase(
        "find-thread",
        () => database.select({ id: threads.id })
          .from(threads)
          .where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
          .limit(1),
      ));
      if (ownedThreads[0]) return Result.ok(undefined);

      const timestamp = new Date();
      yield* Result.await(runDatabase(
        "revoke-session-binding",
        () => database.update(eveSessionBindings)
          .set({ revokedAt: timestamp, purgeRequestedAt: timestamp })
          .where(eq(eveSessionBindings.sessionId, sessionId)),
      ));
      return Result.err(new EveAuthorizationError({
        code: "thread_forbidden",
        message: "Eve session thread was deleted before binding completed",
      }));
    });
  }

  async function releaseLeaseResult(auth: SessionAuthContext | null) {
    const leaseId = readAttribute(auth, "leaseId");
    const userId = auth?.principalId;
    if (!leaseId || !userId) return Result.ok(undefined);

    return runDatabase(
      "release-lease",
      async () => {
        await database.delete(agentRunLeases).where(and(
          eq(agentRunLeases.subjectKey, keyedHash(`lease:${userId}`)),
          eq(agentRunLeases.leaseId, leaseId),
        ));
      },
    );
  }

  async function verifySessionBinding(
    sessionId: string,
    userId: string,
    threadId: string,
    threadState: string | null,
    threadRevision: number,
  ) {
    return Result.gen(async function* () {
      const initialBindings = yield* Result.await(runDatabase(
        "find-session-binding",
        () => database.select()
          .from(eveSessionBindings)
          .where(eq(eveSessionBindings.sessionId, sessionId))
          .limit(1),
      ));
      let binding = initialBindings[0];

      // Migration-created rows keep revision 0. Once the client has patched a
      // thread, its mutable state must never be trusted to claim an Eve id.
      if (!binding && threadRevision === 0) {
        const storedSessionId = yield* sessionIdFromThreadState(threadState);
        if (storedSessionId === sessionId) {
          yield* Result.await(runDatabase(
            "bind-session",
            () => database.insert(eveSessionBindings)
              .values({ sessionId, userId, threadId })
              .onConflictDoNothing({ target: eveSessionBindings.sessionId }),
          ));
          const backfilledBindings = yield* Result.await(runDatabase(
            "find-session-binding",
            () => database.select()
              .from(eveSessionBindings)
              .where(eq(eveSessionBindings.sessionId, sessionId))
              .limit(1),
          ));
          binding = backfilledBindings[0];
        }
      }

      if (
        binding
        && !binding.revokedAt
        && binding.userId === userId
        && binding.threadId === threadId
      ) {
        return Result.ok(undefined);
      }
      return Result.err(new EveAuthorizationError({
        code: "eve_session_forbidden",
        message: "Eve session does not belong to this thread",
      }));
    });
  }

  async function authenticateRequest(request: Request) {
    return Result.gen(async function* () {
      const session = yield* Result.await(Result.tryPromise({
        try: () => options.getSession(request.headers),
        catch: cause => new EveAuthenticationError({
          cause,
          message: "Eve authentication could not be completed",
          retryable: true,
        }),
      }));
      if (!session?.user) return Result.ok(null);

      const match = SESSION_ROUTE.exec(new URL(request.url).pathname);
      if (!match) {
        return Result.ok({
          attributes: {},
          authenticator: "app",
          issuer: "app",
          principalId: session.user.id,
          principalType: "user",
        } satisfies SessionAuthContext);
      }

      const threadId = yield* validateThreadId(request.headers.get("x-thread-id"));
      const ownedThreads = yield* Result.await(runDatabase(
        "find-thread",
        () => database.select({
          id: threads.id,
          state: threads.state,
          stateVersion: threads.stateVersion,
        })
          .from(threads)
          .where(and(eq(threads.id, threadId), eq(threads.userId, session.user.id)))
          .limit(1),
      ));
      const thread = ownedThreads[0];
      if (!thread) {
        return Result.err(new EveAuthorizationError({
          code: "thread_forbidden",
          message: "Thread does not belong to this user",
        }));
      }

      const eveSessionId = match[1]
        ? yield* decodeEveSessionId(match[1])
        : null;
      if (eveSessionId) {
        yield* Result.await(verifySessionBinding(
          eveSessionId,
          session.user.id,
          threadId,
          thread.state,
          thread.stateVersion,
        ));
      }

      let leaseId: string | null = null;
      if (request.method === "POST") {
        if (Result.isError(validateSameOrigin(request))) {
          yield* new EveAuthorizationError({
            code: "origin_forbidden",
            message: "Request origin is not allowed",
          });
        }
        const body = yield* Result.await(readTurnBody(request, limits.maxBodyBytes));
        const payload = yield* validateTurnPayload(body, eveSessionId !== null);
        if (payloadTextLength(payload) > limits.maxMessageChars) {
          yield* new EveRequestError({
            code: "message_too_large",
            message: "Message is too large",
            status: 413,
          });
        }

        const ip = requestIp(request, session.user.id);
        yield* Result.await(runDatabase(
          "clean-rate-limits",
          async () => {
            await database.delete(agentRateLimits)
              .where(lte(agentRateLimits.expiresAt, new Date()));
          },
        ));
        yield* Result.await(consumeCounter(
          "user-minute",
          session.user.id,
          60,
          limits.userPerMinute,
        ));
        yield* Result.await(consumeCounter(
          "user-day",
          session.user.id,
          86_400,
          limits.userPerDay,
        ));
        yield* Result.await(consumeCounter(
          "ip-hour",
          ip,
          3_600,
          limits.ipPerHour,
        ));
        leaseId = yield* Result.await(acquireLease(session.user.id));
      }

      return Result.ok({
        attributes: {
          email: session.user.email,
          name: session.user.name,
          threadId,
          ...(leaseId ? { leaseId } : {}),
        },
        authenticator: "app",
        issuer: "app",
        principalId: session.user.id,
        principalType: "user",
      } satisfies SessionAuthContext);
    });
  }

  async function bindSessionFromAuth(
    sessionId: string,
    auth: SessionAuthContext | null,
  ) {
    const result = await bindSessionResult(sessionId, auth);
    if (Result.isError(result)) {
      const released = await releaseLeaseResult(auth);
      if (Result.isError(released)) throw toEventError(released.error);
      throw toEventError(result.error);
    }
  }

  async function releaseLeaseFromAuth(auth: SessionAuthContext | null) {
    const result = await releaseLeaseResult(auth);
    if (Result.isError(result)) throw toEventError(result.error);
  }

  const auth: AuthFn<Request> = async (request) => {
    const result = await authenticateRequest(request);
    if (Result.isError(result)) throw toHttpError(result.error);
    return result.value;
  };

  // Eve's session.failed callback intentionally has no SessionContext/auth.
  // Normal failures release on turn.failed; the DB lease TTL recovers failures
  // that happen before Eve can create an authenticated turn context.
  const events: EveChannelEvents = {
    "turn.started": async (_data, _channel, context) => {
      await bindSessionFromAuth(context.session.id, context.session.auth.current);
    },
    "turn.completed": async (_data, _channel, context) => {
      await releaseLeaseFromAuth(context.session.auth.current);
    },
    "turn.failed": async (_data, _channel, context) => {
      await releaseLeaseFromAuth(context.session.auth.current);
    },
    "session.completed": async (_data, _channel, context) => {
      await releaseLeaseFromAuth(context.session.auth.current);
    },
    "session.waiting": async (_data, _channel, context) => {
      await releaseLeaseFromAuth(context.session.auth.current);
    },
  };

  return {
    auth,
    events,
    bindSessionFromAuth,
    releaseLeaseFromAuth,
  };
}
