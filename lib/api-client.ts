import { treaty } from "@elysiajs/eden";
import { Result } from "better-result";
import type { z } from "zod";
import type { ApiApp } from "@/server/api/app";
import {
  apiErrorSchema,
  threadApiSchemas,
  type ThreadApiError,
} from "@/server/api/contracts";
import type {
  CreateThreadInput,
  PatchThreadInput,
} from "@/server/schemas/threads";
import type { ThreadSummary } from "@/shared/types/thread";

type PublicApiErrorCode = ThreadApiError["error"]["code"];

export type ThreadApiErrorCode =
  | PublicApiErrorCode
  | "invalid_response"
  | "network_error";

export class ThreadApiClientError extends Error {
  readonly code: ThreadApiErrorCode;
  readonly retryable: boolean;
  readonly status: number;

  constructor(args: {
    readonly cause?: unknown;
    readonly code: ThreadApiErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly status: number;
  }) {
    super(args.message, { cause: args.cause });
    this.name = "ThreadApiClientError";
    this.code = args.code;
    this.retryable = args.retryable;
    this.status = args.status;
  }
}

export type ThreadTransportResult = {
  readonly data: unknown;
  readonly error: null | {
    readonly status: number;
    readonly value: unknown;
  };
};

export type ThreadApiTransport = ReturnType<typeof createEdenThreadTransport>;
export type ThreadApiClient = ReturnType<typeof createThreadApiClient>;
type ThreadUpdateRequest = Readonly<{
  expectedRevision: ThreadSummary["revision"];
  id: ThreadSummary["id"];
  input: PatchThreadInput;
}>;

const mutationRetryDelaysMs = [300, 900] as const satisfies readonly number[];

function acceptResponse(
  result: ThreadTransportResult,
): Result<void, ThreadApiClientError> {
  if (!result.error) return Result.ok(undefined);

  const parsed = apiErrorSchema.safeParse(result.error.value);
  if (!parsed.success) {
    return Result.err(new ThreadApiClientError({
      code: "invalid_response",
      message: "API returned an invalid error response",
      retryable: false,
      status: result.error.status,
    }));
  }

  const { code, message, retryable } = parsed.data.error;
  return Result.err(new ThreadApiClientError({
    code,
    message,
    retryable,
    status: result.error.status,
  }));
}

function validateResponse<TSchema extends z.ZodType>(
  result: ThreadTransportResult,
  schema: TSchema,
): Result<z.output<TSchema>, ThreadApiClientError> {
  const parsed = schema.safeParse(normalizeTransportValue(result.data));
  if (parsed.success) return Result.ok(parsed.data);

  return Result.err(new ThreadApiClientError({
    cause: parsed.error,
    code: "invalid_response",
    message: "API returned an invalid success response",
    retryable: false,
    status: 200,
  }));
}

function normalizeTransportValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeTransportValue);
  if (value === null || typeof value !== "object") return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeTransportValue(item)]),
  );
}

async function execute<TSchema extends z.ZodType, TValue>(
  request: () => Promise<ThreadTransportResult>,
  schema: TSchema,
  select: (value: z.output<TSchema>) => TValue,
): Promise<TValue> {
  const result = await Result.gen(async function* () {
    const transportResult = yield* Result.await(Result.tryPromise({
      try: request,
      catch: cause => new ThreadApiClientError({
        cause,
        code: "network_error",
        message: "API request failed",
        retryable: true,
        status: 0,
      }),
    }));
    yield* acceptResponse(transportResult);
    const value = yield* validateResponse(transportResult, schema);
    return Result.ok(select(value));
  });

  // TanStack Query's queryFn/mutationFn contract represents failure by rejection.
  if (Result.isError(result)) throw result.error;
  return result.value;
}

export function createThreadApiClient(transport: ThreadApiTransport) {
  return {
    create: (input: CreateThreadInput) => execute(
      () => transport.create(input),
      threadApiSchemas.threadResponse,
      result => result.thread,
    ),
    delete: (id: ThreadSummary["id"]) => execute(
      () => transport.delete(id),
      threadApiSchemas.deleteResponse,
      () => undefined,
    ),
    get: (id: ThreadSummary["id"]) => execute(
      () => transport.get(id),
      threadApiSchemas.threadResponse,
      result => result.thread,
    ),
    list: () => execute(
      transport.list,
      threadApiSchemas.listResponse,
      result => result.threads,
    ),
    update: (args: ThreadUpdateRequest) => execute(
      () => transport.update(args),
      threadApiSchemas.threadResponse,
      result => result.thread,
    ),
  } as const;
}

export function createEdenThreadTransport(baseUrl: string) {
  const api = treaty<ApiApp>(baseUrl).api.v1;

  const normalizeError = (error: unknown): ThreadTransportResult["error"] => {
    if (error === null || error === undefined) return null;
    if (typeof error !== "object" || !("status" in error) || !("value" in error)) {
      return { status: 0, value: error };
    }

    const status = Number(error.status);
    return {
      status: Number.isFinite(status) ? status : 0,
      value: error.value,
    };
  };

  const normalize = async <TResult extends {
    readonly data: unknown;
    readonly error: unknown;
  }>(response: Promise<TResult>): Promise<ThreadTransportResult> => {
    const result = await response;
    return {
      data: result.data,
      error: normalizeError(result.error),
    };
  };

  return {
    create: (input: CreateThreadInput) => normalize(api.threads.post(input)),
    delete: (id: ThreadSummary["id"]) => normalize(api.threads({ id }).delete()),
    get: (id: ThreadSummary["id"]) => normalize(api.threads({ id }).get()),
    list: () => normalize(api.threads.get()),
    update: ({ expectedRevision, id, input }: ThreadUpdateRequest) => normalize(api.threads({ id }).patch(input, {
      headers: { "x-thread-revision": `"${expectedRevision}"` },
    })),
  } as const;
}

/** Browser-facing query/mutation adapter. Server Components use the application service directly. */
export function createApiClient(baseUrl: string): ThreadApiClient {
  return createThreadApiClient(createEdenThreadTransport(baseUrl));
}

/** TanStack Query retry predicate: two retries, only for errors classified by the adapter. */
export function shouldRetryThreadApiError(
  failureCount: number,
  error: unknown,
): boolean {
  return failureCount < mutationRetryDelaysMs.length
    && error instanceof ThreadApiClientError
    && error.retryable;
}

/** Keep the previous short retry cadence while TanStack Query owns the scheduling. */
export function threadApiRetryDelay(failureCount: number): number {
  return mutationRetryDelaysMs[Math.min(failureCount, mutationRetryDelaysMs.length - 1)];
}

/** Shared browser adapter. Client Components never call application endpoints directly. */
export const threadApiClient = createApiClient(
  typeof window === "undefined" ? "http://localhost" : window.location.origin,
);
