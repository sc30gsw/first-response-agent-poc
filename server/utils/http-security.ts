import { Result, TaggedError } from "better-result";

const JSON_CONTENT_TYPE = "application/json";

type JsonBodyErrorReason =
  | "body-too-large"
  | "content-length"
  | "content-type"
  | "invalid-body"
  | "invalid-json";

export class JsonBodyError extends TaggedError("JsonBodyError")<{
  readonly cause?: unknown;
  readonly message: string;
  readonly reason: JsonBodyErrorReason;
  readonly status: 400 | 413 | 415;
}>() {}

export class SameOriginError extends TaggedError("SameOriginError")<{
  readonly message: string;
}>() {}

export function validateSameOrigin(
  request: Request,
): Result<void, SameOriginError> {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin
    ? Result.ok(undefined)
    : Result.err(new SameOriginError({
        message: "Request origin is not allowed",
      }));
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<Result<unknown, JsonBodyError>> {
  const contentType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    return Result.err(new JsonBodyError({
      message: "Content-Type must be application/json",
      reason: "content-type",
      status: 415,
    }));
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      return Result.err(new JsonBodyError({
        message: "Content-Length is invalid",
        reason: "content-length",
        status: 400,
      }));
    }
    if (bytes > maxBytes) {
      return Result.err(new JsonBodyError({
        message: "Request body is too large",
        reason: "body-too-large",
        status: 413,
      }));
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return Result.err(new JsonBodyError({
      message: "JSON body is required",
      reason: "invalid-body",
      status: 400,
    }));
  }

  const read = await Result.tryPromise({
    try: async () => {
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          return { kind: "limit" } as const;
        }
        chunks.push(value);
      }

      const bytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { bytes, kind: "success" } as const;
    },
    catch: cause => new JsonBodyError({
      cause,
      message: "Request body could not be read",
      reason: "invalid-body",
      status: 400,
    }),
  });
  if (Result.isError(read)) return Result.err(read.error);
  if (read.value.kind === "limit") {
    return Result.err(new JsonBodyError({
      message: "Request body is too large",
      reason: "body-too-large",
      status: 413,
    }));
  }

  return Result.try({
    try: () => JSON.parse(
      new TextDecoder().decode(read.value.bytes),
    ) as unknown,
    catch: cause => new JsonBodyError({
      cause,
      message: "JSON body is invalid",
      reason: "invalid-json",
      status: 400,
    }),
  });
}
