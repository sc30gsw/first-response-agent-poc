import { Result } from "better-result";
import type { z } from "zod";
import type { ThreadResponse } from "@/shared/types/thread";
import type { AppDatabase } from "../db/client";
import { db } from "../db/client";
import type { Thread } from "../db/schema/threads";
import {
  createThreadBodySchema,
  type CreateThreadInput,
  patchThreadBodySchema,
  type PatchThreadInput,
  threadIdParamsSchema,
} from "../schemas/threads";
import {
  createThreadForUser,
  deleteThreadForUser,
  getThreadForUser,
  listThreadsForUser,
  StaleThreadStateError,
  ThreadLimitExceededError,
  type ThreadRepositoryError,
  updateThreadForUser,
} from "../utils/threads";
import {
  ConflictError,
  DatabaseError,
  LimitError,
  NotFoundError,
  type ThreadApplicationError,
  ValidationError,
} from "./thread-errors";

type ThreadOperation = ThreadApplicationError["operation"];
export type ThreadRepository = {
  readonly create: (
    userId: Parameters<typeof createThreadForUser>[0],
    input: Parameters<typeof createThreadForUser>[1],
  ) => ReturnType<typeof createThreadForUser>;
  readonly delete: (
    userId: Parameters<typeof deleteThreadForUser>[0],
    id: Parameters<typeof deleteThreadForUser>[1],
  ) => ReturnType<typeof deleteThreadForUser>;
  readonly get: (
    userId: Parameters<typeof getThreadForUser>[0],
    id: Parameters<typeof getThreadForUser>[1],
  ) => ReturnType<typeof getThreadForUser>;
  readonly list: (
    userId: Parameters<typeof listThreadsForUser>[0],
  ) => ReturnType<typeof listThreadsForUser>;
  readonly update: (
    userId: Parameters<typeof updateThreadForUser>[0],
    id: Parameters<typeof updateThreadForUser>[1],
    patch: Parameters<typeof updateThreadForUser>[2],
    expectedRevision: Parameters<typeof updateThreadForUser>[3],
  ) => ReturnType<typeof updateThreadForUser>;
};

export type ThreadApplicationDependencies = {
  readonly repository: ThreadRepository;
};

export function createThreadRepository(database: AppDatabase = db): ThreadRepository {
  return {
    create: (userId, input) => createThreadForUser(userId, input, database),
    delete: (userId, id) => deleteThreadForUser(userId, id, database),
    get: (userId, id) => getThreadForUser(userId, id, database),
    list: userId => listThreadsForUser(userId, database),
    update: (userId, id, patch, expectedRevision) =>
      updateThreadForUser(userId, id, patch, expectedRevision, database),
  } as const satisfies ThreadRepository;
}

const defaultDependencies = {
  repository: createThreadRepository(),
} as const satisfies ThreadApplicationDependencies;

function validate<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  operation: ThreadOperation,
): Result<z.output<TSchema>, ValidationError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return Result.ok(parsed.data);

  return Result.err(new ValidationError({
    issues: parsed.error.issues.map(issue => issue.path.join(".") || "request"),
    message: "The request is invalid",
    operation,
    reason: "invalid-input",
  }));
}

function validateExpectedRevision(
  revision: Thread["stateVersion"],
): Result<Thread["stateVersion"], ValidationError> {
  return Number.isSafeInteger(revision) && revision >= 0
    ? Result.ok(revision)
    : Result.err(new ValidationError({
        issues: ["expectedRevision"],
        message: "A valid expected revision is required",
        operation: "update-thread",
        reason: "invalid-revision",
      }));
}

function repositoryFailure(
  cause: unknown,
  operation: ThreadOperation,
): DatabaseError {
  return new DatabaseError({
    cause,
    message: "The data operation failed",
    operation,
    retryable: true,
  });
}

function expectedRepositoryFailure(
  error: ThreadRepositoryError,
  operation: ThreadOperation,
  id?: Thread["id"],
): DatabaseError | ConflictError | LimitError {
  if (error instanceof ThreadLimitExceededError) {
    return new LimitError({
      message: "Thread limit exceeded",
      operation,
      reason: "thread-count",
      retryable: false,
    });
  }
  if (error instanceof StaleThreadStateError) {
    return new ConflictError({
      id: id ?? error.threadId,
      message: "Thread state is stale",
      operation,
      reason: "stale-revision",
    });
  }
  return new DatabaseError({
    cause: error,
    message: "The data operation failed",
    operation,
    retryable: false,
  });
}

function runRepository<T>(
  operation: ThreadOperation,
  task: () => Promise<T>,
) {
  return Result.tryPromise({
    try: task,
    catch: cause => repositoryFailure(cause, operation),
  });
}

async function runResultRepository<T>(
  operation: ThreadOperation,
  task: () => Promise<Result<T, ThreadRepositoryError>>,
  id?: Thread["id"],
): Promise<Result<T, ThreadApplicationError>> {
  const result = await runRepository(operation, task);
  if (Result.isError(result)) return Result.err(result.error);
  if (Result.isError(result.value)) {
    return Result.err(expectedRepositoryFailure(result.value.error, operation, id));
  }
  return Result.ok(result.value.value);
}

export function createThreadApplicationService(
  dependencies: ThreadApplicationDependencies = defaultDependencies,
) {
  return {
    async list(
      userId: Thread["userId"],
    ): Promise<Result<{
      readonly threads: Awaited<ReturnType<ThreadRepository["list"]>>;
    }, ThreadApplicationError>> {
      const threads = await runRepository(
        "list-threads",
        () => dependencies.repository.list(userId),
      );
      return Result.isError(threads)
        ? Result.err(threads.error)
        : Result.ok({ threads: threads.value } as const);
    },

    async get(
      userId: Thread["userId"],
      id: unknown,
    ): Promise<Result<ThreadResponse, ThreadApplicationError>> {
      return Result.gen(async function* () {
        const params = yield* validate(threadIdParamsSchema, { id }, "get-thread");
        const thread = yield* Result.await(runResultRepository(
          "get-thread",
          () => dependencies.repository.get(userId, params.id),
          params.id,
        ));
        if (!thread) {
          return Result.err(new NotFoundError({
            id: params.id,
            message: "Thread not found",
            operation: "get-thread",
            resource: "thread",
          }));
        }
        return Result.ok({ thread } as const);
      });
    },

    async create(
      userId: Thread["userId"],
      input: CreateThreadInput,
    ): Promise<Result<ThreadResponse, ThreadApplicationError>> {
      return Result.gen(async function* () {
        const validInput = yield* validate(createThreadBodySchema, input, "create-thread");
        const thread = yield* Result.await(runResultRepository(
          "create-thread",
          () => dependencies.repository.create(userId, validInput),
        ));
        return Result.ok({ thread } as const);
      });
    },

    async update(args: {
      readonly expectedRevision: Thread["stateVersion"];
      readonly id: unknown;
      readonly input: PatchThreadInput;
      readonly userId: Thread["userId"];
    }): Promise<Result<ThreadResponse, ThreadApplicationError>> {
      return Result.gen(async function* () {
        const params = yield* validate(threadIdParamsSchema, { id: args.id }, "update-thread");
        const validInput = yield* validate(patchThreadBodySchema, args.input, "update-thread");
        const revision = yield* validateExpectedRevision(args.expectedRevision);
        const thread = yield* Result.await(runResultRepository(
          "update-thread",
          () => dependencies.repository.update(args.userId, params.id, validInput, revision),
          params.id,
        ));
        if (!thread) {
          return Result.err(new NotFoundError({
            id: params.id,
            message: "Thread not found",
            operation: "update-thread",
            resource: "thread",
          }));
        }
        return Result.ok({ thread } as const);
      });
    },

    async delete(
      userId: Thread["userId"],
      id: unknown,
    ): Promise<Result<{ readonly ok: true }, ThreadApplicationError>> {
      return Result.gen(async function* () {
        const params = yield* validate(threadIdParamsSchema, { id }, "delete-thread");
        const deleted = yield* Result.await(runRepository(
          "delete-thread",
          () => dependencies.repository.delete(userId, params.id),
        ));
        if (!deleted) {
          return Result.err(new NotFoundError({
            id: params.id,
            message: "Thread not found",
            operation: "delete-thread",
            resource: "thread",
          }));
        }
        return Result.ok({ ok: true } as const);
      });
    },
  } as const;
}

export type ThreadApplicationService = ReturnType<typeof createThreadApplicationService>;

/** Shared application service for the API boundary and authenticated Server Components. */
export const threadApplicationService = createThreadApplicationService();
