import { TaggedError } from "better-result";
import type { ThreadId } from "@/shared/types/thread";

type Operation =
  | "authenticate"
  | "create-thread"
  | "delete-thread"
  | "get-thread"
  | "list-threads"
  | "update-thread";

export class UnauthorizedError extends TaggedError("UnauthorizedError")<{
  readonly message: string;
  readonly operation: Operation;
}>() {}

export class ForbiddenError extends TaggedError("ForbiddenError")<{
  readonly message: string;
  readonly operation: Operation;
  readonly reason: "cross-origin";
}>() {}

export class ValidationError extends TaggedError("ValidationError")<{
  readonly cause?: unknown;
  readonly issues: readonly string[];
  readonly message: string;
  readonly operation: Operation;
  readonly reason:
    | "content-length"
    | "content-type"
    | "if-match"
    | "invalid-body"
    | "invalid-input"
    | "invalid-json"
    | "invalid-revision";
}>() {}

export class NotFoundError extends TaggedError("NotFoundError")<{
  readonly id: ThreadId;
  readonly message: string;
  readonly operation: Operation;
  readonly resource: "thread";
}>() {}

export class ConflictError extends TaggedError("ConflictError")<{
  readonly id: ThreadId;
  readonly message: string;
  readonly operation: Operation;
  readonly reason: "stale-revision";
}>() {}

export class LimitError extends TaggedError("LimitError")<{
  readonly message: string;
  readonly operation: Operation;
  readonly reason: "request-body-too-large" | "thread-count";
  readonly retryable: boolean;
}>() {}

export class DatabaseError extends TaggedError("DatabaseError")<{
  readonly cause?: unknown;
  readonly message: string;
  readonly operation: Operation;
  readonly retryable: boolean;
}>() {}

export type ThreadApplicationError =
  | UnauthorizedError
  | ForbiddenError
  | ValidationError
  | NotFoundError
  | ConflictError
  | LimitError
  | DatabaseError;
