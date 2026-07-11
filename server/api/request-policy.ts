import { Result } from "better-result";
import {
  DatabaseError,
  ForbiddenError,
  type ThreadApplicationError,
  UnauthorizedError,
  ValidationError,
} from "../application/thread-errors";

type ThreadOperation = ThreadApplicationError["operation"];
type MutationOperation = Extract<
  ThreadOperation,
  "create-thread" | "delete-thread" | "update-thread"
>;

export type GetAuthenticatedUserId = (
  headers: Headers,
) => Promise<string | null>;

export async function authenticateThreadRequest(
  headers: Headers,
  operation: ThreadOperation,
  getUserId: GetAuthenticatedUserId,
): Promise<Result<string, UnauthorizedError | DatabaseError>> {
  const authenticated = await Result.tryPromise({
    try: () => getUserId(headers),
    catch: cause => new DatabaseError({
      cause,
      message: "Authentication could not be completed",
      operation: "authenticate",
      retryable: true,
    }),
  });
  if (Result.isError(authenticated)) return Result.err(authenticated.error);
  if (authenticated.value) return Result.ok(authenticated.value);

  return Result.err(new UnauthorizedError({
    message: "Authentication is required",
    operation,
  }));
}

export function validateMutationOrigin(
  request: Request,
  operation: MutationOperation,
): Result<void, ForbiddenError> {
  return request.headers.get("origin") === new URL(request.url).origin
    ? Result.ok(undefined)
    : Result.err(new ForbiddenError({
        message: "The request origin is not allowed",
        operation,
        reason: "cross-origin",
      }));
}

export function parseIfMatchRevision(
  value: string | null,
): Result<number, ValidationError> {
  const match = /^"(0|[1-9]\d*)"$/u.exec(value ?? "");
  const revision = match ? Number(match[1]) : Number.NaN;

  return Number.isSafeInteger(revision)
    ? Result.ok(revision)
    : Result.err(new ValidationError({
        issues: ["if-match"],
        message: "A valid If-Match revision is required",
        operation: "update-thread",
        reason: "if-match",
      }));
}
