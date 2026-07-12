import { Result } from "better-result";
import { readJsonBody } from "../utils/http-security";
import { LimitError, ValidationError } from "../application/thread-errors";

export const MAX_THREAD_REQUEST_BYTES = 1024 * 1024;

type JsonMutationOperation = "create-thread" | "update-thread";

function validationError(
  operation: JsonMutationOperation,
  reason: "content-length" | "content-type" | "invalid-body" | "invalid-json",
  issue: string,
  message: string,
  cause?: unknown,
) {
  return new ValidationError({
    cause,
    issues: [issue],
    message,
    operation,
    reason,
  });
}

function limitError(operation: JsonMutationOperation) {
  return new LimitError({
    message: "Request body is too large",
    operation,
    reason: "request-body-too-large",
    retryable: false,
  });
}

export async function readLimitedJsonBody(
  request: Request,
  operation: JsonMutationOperation,
  maxBytes = MAX_THREAD_REQUEST_BYTES,
): Promise<Result<unknown, LimitError | ValidationError>> {
  const read = await readJsonBody(request, maxBytes);
  if (Result.isOk(read)) return Result.ok(read.value);
  if (read.error.reason === "body-too-large") {
    return Result.err(limitError(operation));
  }

  const reason = read.error.reason;
  return Result.err(validationError(
    operation,
    reason,
    reason === "content-length" ? "content-length"
      : reason === "content-type" ? "content-type"
        : "body",
    read.error.message,
    read.error.cause,
  ));
}
