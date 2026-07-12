import { openapi } from "@elysiajs/openapi";
import { Result, matchError } from "better-result";
import { Elysia } from "elysia";
import { z } from "zod";
import {
  createThreadApplicationService,
  createThreadRepository,
  type ThreadApplicationService,
  type ThreadRepository,
} from "../application/thread-service";
import type { ThreadApplicationError } from "../application/thread-errors";
import { LimitError, ValidationError } from "../application/thread-errors";
import type { User } from "../db/schema/auth";
import { getSessionUserId } from "../utils/session";
import { readLimitedJsonBody } from "./body-parser";
import { threadApiSchemas, threadErrorResponses } from "./contracts";
import { addThreadEtagResponseHeaders } from "./openapi-contract";
import {
  authenticateThreadRequest,
  type GetAuthenticatedUserId,
  parseIfMatchRevision,
  validateMutationOrigin,
} from "./request-policy";

const API_PREFIX = "/api/v1";
const THREAD_TAG = "Threads";

type RouteDetail = {
  readonly description?: string;
  readonly security?: Record<string, string[]>[];
  readonly summary: string;
  readonly tags: string[];
};

const authenticatedRoute = {
  security: [{ sessionCookie: [] }],
  tags: [THREAD_TAG],
} as const satisfies Pick<RouteDetail, "security" | "tags">;

const routeDetails = {
  create: {
    ...authenticatedRoute,
    description: "Creates a case consultation thread and returns its revision in the ETag header.",
    summary: "Create a thread",
  },
  delete: {
    ...authenticatedRoute,
    summary: "Delete a thread",
  },
  get: {
    ...authenticatedRoute,
    description: "Returns the thread revision in the ETag header.",
    summary: "Get a thread",
  },
  list: {
    ...authenticatedRoute,
    summary: "List threads",
  },
  update: {
    ...authenticatedRoute,
    description: "Updates a thread when If-Match is current and returns the new ETag revision.",
    summary: "Update a thread",
  },
} as const satisfies Record<string, RouteDetail>;

const errorMessages = {
  ConflictError: "The thread was updated by another request",
  DatabaseError: "The request could not be completed",
  ForbiddenError: "The request is forbidden",
  LimitError: "A request limit was exceeded",
  NotFoundError: "Thread not found",
  UnauthorizedError: "Authentication is required",
  ValidationError: "The request is invalid",
} as const satisfies Record<ThreadApplicationError["_tag"], string>;

const limitErrorStatuses = {
  "request-body-too-large": 413,
  "thread-count": 429,
} as const satisfies Record<LimitError["reason"], 413 | 429>;

const validationErrorStatuses = {
  "content-length": 400,
  "content-type": 415,
  "if-match": 428,
  "invalid-body": 400,
  "invalid-input": 400,
  "invalid-json": 400,
  "invalid-revision": 400,
} as const satisfies Record<ValidationError["reason"], 400 | 415 | 428>;

function errorBody(
  code: z.infer<typeof threadApiSchemas.error>["error"]["code"],
  message: string,
) {
  return { error: { code, message } } as const;
}

function jsonResponse(
  data: unknown,
  status: number,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("cache-control", "no-store");
  return Response.json(data, {
    headers: responseHeaders,
    status,
  });
}

function applicationErrorResponse(error: ThreadApplicationError): Response {
  return matchError<ThreadApplicationError, Response>(error, {
    ConflictError: () => jsonResponse(errorBody("conflict", errorMessages.ConflictError), 409),
    DatabaseError: (databaseError) => {
      console.error("Thread API database failure", {
        operation: databaseError.operation,
        retryable: databaseError.retryable,
      });
      return jsonResponse(errorBody("database_error", errorMessages.DatabaseError), 500);
    },
    ForbiddenError: () => jsonResponse(errorBody("forbidden", errorMessages.ForbiddenError), 403),
    LimitError: limitError => jsonResponse(
      errorBody("limit_exceeded", errorMessages.LimitError),
      limitErrorStatuses[limitError.reason],
    ),
    NotFoundError: () => jsonResponse(errorBody("not_found", errorMessages.NotFoundError), 404),
    UnauthorizedError: () => jsonResponse(errorBody("unauthorized", errorMessages.UnauthorizedError), 401),
    ValidationError: validationError => jsonResponse(
      errorBody("validation_error", validationError.message),
      validationErrorStatuses[validationError.reason],
    ),
  });
}

function applicationResponse<T>(
  result: Result<T, ThreadApplicationError>,
  successStatus: 200 | 201 = 200,
): Response {
  return Result.isError(result)
    ? applicationErrorResponse(result.error)
    : jsonResponse(result.value, successStatus);
}

function threadApplicationResponse<T extends { readonly thread: { readonly revision: number } }>(
  result: Result<T, ThreadApplicationError>,
  successStatus: 200 | 201 = 200,
): Response {
  return Result.isError(result)
    ? applicationErrorResponse(result.error)
    : jsonResponse(result.value, successStatus, {
        etag: `"${result.value.thread.revision}"`,
      });
}

async function runAuthenticated<T>(args: {
  readonly action: (userId: User["id"]) => Promise<Result<T, ThreadApplicationError>>;
  readonly getUserId: GetAuthenticatedUserId;
  readonly operation: ThreadApplicationError["operation"];
  readonly request: Request;
}): Promise<Result<T, ThreadApplicationError>> {
  const authentication = await authenticateThreadRequest(
    args.request.headers,
    args.operation,
    args.getUserId,
  );
  return Result.isError(authentication)
    ? Result.err(authentication.error)
    : args.action(authentication.value);
}

async function runAuthenticatedMutation<T>(args: {
  readonly action: (userId: User["id"]) => Promise<Result<T, ThreadApplicationError>>;
  readonly getUserId: GetAuthenticatedUserId;
  readonly operation: "create-thread" | "delete-thread" | "update-thread";
  readonly request: Request;
}): Promise<Result<T, ThreadApplicationError>> {
  return runAuthenticated({
    ...args,
    action: async (userId) => {
      const origin = validateMutationOrigin(args.request, args.operation);
      return Result.isError(origin)
        ? Result.err(origin.error)
        : args.action(userId);
    },
  });
}

function isThreadMutation(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  return pathname.startsWith(`${API_PREFIX}/threads`)
    && ["DELETE", "PATCH", "POST"].includes(request.method);
}

function jsonMutationOperation(
  request: Request,
): "create-thread" | "update-thread" | null {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(`${API_PREFIX}/threads`)) return null;
  if (request.method === "POST") return "create-thread";
  if (request.method === "PATCH") return "update-thread";
  return null;
}

type CreateApiAppOptions = {
  readonly getUserId?: GetAuthenticatedUserId;
  readonly repository?: ThreadRepository;
  readonly service?: ThreadApplicationService;
};

export function createApiApp(options: CreateApiAppOptions = {}) {
  const getUserId = options.getUserId ?? getSessionUserId;
  const service = options.service
    ?? createThreadApplicationService({
      repository: options.repository ?? createThreadRepository(),
    });

  return new Elysia({ prefix: API_PREFIX })
    .onRequest(({ set }) => {
      set.headers["cache-control"] = "no-store";
    })
    .onParse(async ({ request }) => {
      const operation = jsonMutationOperation(request);
      if (!operation) return;

      const result = await readLimitedJsonBody(request, operation);
      if (Result.isError(result)) {
        // Parser hooks use framework error control flow; onError immediately maps
        // this typed expected failure to a plain JSON response.
        throw result.error;
      }
      return result.value;
    })
    .onAfterHandle({ as: "global" }, ({ request, responseValue }) => {
      if (new URL(request.url).pathname !== `${API_PREFIX}/openapi/json`) return;
      return addThreadEtagResponseHeaders(responseValue);
    })
    .use(openapi({
      path: "/openapi",
      scalar: {
        version: "1.62.5",
      },
      mapJsonSchema: {
        zod: z.toJSONSchema,
      },
      documentation: {
        info: {
          title: "First Response Agent API",
          version: "1.0.0",
          description: "Authenticated API for case consultation threads.",
        },
        tags: [{
          name: THREAD_TAG,
          description: "Create and manage the current user's consultation threads.",
        }],
        components: {
          securitySchemes: {
            sessionCookie: {
              type: "apiKey",
              in: "cookie",
              name: "better-auth.session_token",
            },
          },
        },
      },
    }))
    .onError(({ code, error, request, set, status: setStatus }) => {
      set.headers["cache-control"] = "no-store";
      const parseCause = error instanceof Error ? error.cause : undefined;
      const expectedLimit = LimitError.is(error)
        ? error
        : LimitError.is(parseCause) ? parseCause : null;
      if (expectedLimit) {
        return setStatus(
          limitErrorStatuses[expectedLimit.reason],
          errorBody("limit_exceeded", errorMessages.LimitError),
        );
      }
      const expectedValidation = ValidationError.is(error)
        ? error
        : ValidationError.is(parseCause) ? parseCause : null;
      if (expectedValidation) {
        return setStatus(
          validationErrorStatuses[expectedValidation.reason],
          errorBody("validation_error", expectedValidation.message),
        );
      }
      if (code === "VALIDATION" || code === "PARSE") {
        if (request.method === "PATCH"
          && new URL(request.url).pathname.startsWith(`${API_PREFIX}/threads/`)) {
          const revision = parseIfMatchRevision(request.headers.get("if-match"));
          if (Result.isError(revision)) {
            return setStatus(
              validationErrorStatuses[revision.error.reason],
              errorBody("validation_error", revision.error.message),
            );
          }
        }
        const contentType = request.headers.get("content-type")
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        if (isThreadMutation(request)
          && request.method !== "DELETE"
          && contentType !== "application/json") {
          return setStatus(
            415,
            errorBody("validation_error", "Content-Type must be application/json"),
          );
        }
        return setStatus(400, errorBody("validation_error", "The request is invalid"));
      }
      if (code === "NOT_FOUND") {
        return setStatus(404, errorBody("not_found", "Route not found"));
      }
      return setStatus(
        500,
        errorBody("database_error", "The request could not be completed"),
      );
    })
    .get("/threads", async ({ request }) => {
      const result = await runAuthenticated({
        action: userId => service.list(userId),
        getUserId,
        operation: "list-threads",
        request,
      });
      return applicationResponse(result);
    }, {
      response: {
        200: threadApiSchemas.listResponse,
        ...threadErrorResponses,
      },
      detail: routeDetails.list,
    })
    .post("/threads", async ({ body, request }) => {
      const result = await runAuthenticatedMutation({
        action: userId => service.create(userId, body),
        getUserId,
        operation: "create-thread",
        request,
      });
      return threadApplicationResponse(result, 201);
    }, {
      body: threadApiSchemas.createBody,
      response: {
        201: threadApiSchemas.threadResponse,
        ...threadErrorResponses,
      },
      detail: routeDetails.create,
    })
    .get("/threads/:id", async ({ params, request }) => {
      const result = await runAuthenticated({
        action: userId => service.get(userId, params.id),
        getUserId,
        operation: "get-thread",
        request,
      });
      return threadApplicationResponse(result);
    }, {
      params: threadApiSchemas.itemParams,
      response: {
        200: threadApiSchemas.threadResponse,
        ...threadErrorResponses,
      },
      detail: routeDetails.get,
    })
    .patch("/threads/:id", async ({ body, params, request }) => {
      const result = await runAuthenticatedMutation({
        action: async (userId) => {
          const revision = parseIfMatchRevision(request.headers.get("if-match"));
          return Result.isError(revision)
            ? Result.err(revision.error)
            : service.update({
                expectedRevision: revision.value,
                id: params.id,
                input: body,
                userId,
              });
        },
        getUserId,
        operation: "update-thread",
        request,
      });
      return threadApplicationResponse(result);
    }, {
      body: threadApiSchemas.patchBody,
      headers: threadApiSchemas.ifMatchHeaders,
      params: threadApiSchemas.itemParams,
      response: {
        200: threadApiSchemas.threadResponse,
        ...threadErrorResponses,
      },
      detail: routeDetails.update,
    })
    .delete("/threads/:id", async ({ params, request }) => {
      const result = await runAuthenticatedMutation({
        action: userId => service.delete(userId, params.id),
        getUserId,
        operation: "delete-thread",
        request,
      });
      return applicationResponse(result);
    }, {
      params: threadApiSchemas.itemParams,
      response: {
        200: threadApiSchemas.deleteResponse,
        ...threadErrorResponses,
      },
      detail: routeDetails.delete,
    });
}

export const apiApp = createApiApp();
export type ApiApp = typeof apiApp;
