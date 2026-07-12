import { treaty } from "@elysiajs/eden";
import { Result } from "better-result";
import type { z } from "zod";
import type { ApiApp } from "@/server/api/app";
import { apiErrorSchema, threadApiSchemas } from "@/server/api/contracts";
import type { ThreadRecord, ThreadSummary } from "@/shared/types/thread";

export type CreateThreadInput = z.input<typeof threadApiSchemas.createBody>;
export type PatchThreadInput = z.input<typeof threadApiSchemas.patchBody>;
type PublicApiErrorCode = z.infer<typeof apiErrorSchema>["error"]["code"];

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

export interface ThreadApiTransport {
  readonly create: (input: CreateThreadInput) => Promise<ThreadTransportResult>;
  readonly delete: (id: ThreadSummary["id"]) => Promise<ThreadTransportResult>;
  readonly get: (id: ThreadSummary["id"]) => Promise<ThreadTransportResult>;
  readonly list: () => Promise<ThreadTransportResult>;
  readonly update: (args: {
    readonly expectedRevision: ThreadSummary["revision"];
    readonly id: ThreadSummary["id"];
    readonly input: PatchThreadInput;
  }) => Promise<ThreadTransportResult>;
}

export interface ThreadApiClient {
  readonly create: (input: CreateThreadInput) => Promise<ThreadRecord>;
  readonly delete: (id: ThreadSummary["id"]) => Promise<void>;
  readonly get: (id: ThreadSummary["id"]) => Promise<ThreadRecord>;
  readonly list: () => Promise<ThreadSummary[]>;
  readonly update: (args: {
    readonly expectedRevision: ThreadSummary["revision"];
    readonly id: ThreadSummary["id"];
    readonly input: PatchThreadInput;
  }) => Promise<ThreadRecord>;
}

type EdenResult = {
  readonly data: unknown;
  readonly error: unknown;
};

const retryableStatusCodes = [502, 503, 504] as const satisfies readonly number[];
const mutationRetryDelaysMs = [300, 900] as const satisfies readonly number[];

function isRetryable(status: number, code: PublicApiErrorCode): boolean {
  return code === "database_error"
    || retryableStatusCodes.some(retryableStatus => retryableStatus === status);
}

function acceptResponse(
  result: ThreadTransportResult,
): Result<void, ThreadApiClientError> {
  if (!result.error) return Result.ok(undefined);

  const parsed = apiErrorSchema.safeParse(result.error.value);
  if (!parsed.success) {
    return Result.err(new ThreadApiClientError({
      code: "invalid_response",
      message: "API returned an invalid error response",
      retryable: result.error.status >= 500,
      status: result.error.status,
    }));
  }

  const { code, message } = parsed.data.error;
  return Result.err(new ThreadApiClientError({
    code,
    message,
    retryable: isRetryable(result.error.status, code),
    status: result.error.status,
  }));
}

function validateResponse<TSchema extends z.ZodType>(
  result: ThreadTransportResult,
  schema: TSchema,
): Result<z.output<TSchema>, ThreadApiClientError> {
  const parsed = schema.safeParse(result.data);
  if (parsed.success) return Result.ok(parsed.data);

  return Result.err(new ThreadApiClientError({
    cause: parsed.error,
    code: "invalid_response",
    message: "API returned an invalid success response",
    retryable: false,
    status: 200,
  }));
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

export function createThreadApiClient(transport: ThreadApiTransport): ThreadApiClient {
  return {
    create: input => execute(
      () => transport.create(input),
      threadApiSchemas.threadResponse,
      result => result.thread,
    ),
    delete: id => execute(
      () => transport.delete(id),
      threadApiSchemas.deleteResponse,
      () => undefined,
    ),
    get: id => execute(
      () => transport.get(id),
      threadApiSchemas.threadResponse,
      result => result.thread,
    ),
    list: () => execute(
      transport.list,
      threadApiSchemas.listResponse,
      result => result.threads,
    ),
    update: args => execute(
      () => transport.update(args),
      threadApiSchemas.threadResponse,
      result => result.thread,
    ),
  } as const satisfies ThreadApiClient;
}

export function createEdenThreadTransport(baseUrl: string): ThreadApiTransport {
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

  const normalize = async (response: Promise<EdenResult>): Promise<ThreadTransportResult> => {
    const result = await response;
    return {
      data: result.data,
      error: normalizeError(result.error),
    };
  };

  return {
    create: input => normalize(api.threads.post(input)),
    delete: id => normalize(api.threads({ id }).delete()),
    get: id => normalize(api.threads({ id }).get()),
    list: () => normalize(api.threads.get()),
    update: ({ expectedRevision, id, input }) => normalize(api.threads({ id }).patch(input, {
      headers: { "if-match": `"${expectedRevision}"` },
    })),
  } as const satisfies ThreadApiTransport;
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
