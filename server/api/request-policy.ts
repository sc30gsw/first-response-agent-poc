import { Result } from "better-result";
import type { User } from "../db/schema/auth";
import type { Thread } from "../db/schema/threads";
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
) => Promise<User["id"] | null>;

export async function authenticateThreadRequest(
  headers: Headers,
  operation: ThreadOperation,
  getUserId: GetAuthenticatedUserId,
): Promise<Result<User["id"], UnauthorizedError | DatabaseError>> {
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

export function parseThreadRevisionHeader(
  value: string | null,
): Result<Thread["stateVersion"], ValidationError> {
  const match = /^"(0|[1-9]\d*)"$/u.exec(value ?? "");
  const revision = match ? Number(match[1]) : Number.NaN;

  return Number.isSafeInteger(revision)
    ? Result.ok(revision)
    : Result.err(new ValidationError({
        issues: ["x-thread-revision"],
        message: "A valid X-Thread-Revision header is required",
        operation: "update-thread",
        reason: "thread-revision",
      }));
}
