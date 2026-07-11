import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ThreadResponseSchema, type ThreadRecord } from "../../shared/types/thread";
import * as schema from "../../server/db/schema";
import {
  createThreadRepository,
  type ThreadRepository,
} from "../../server/application/thread-service";
import { createApiApp } from "../../server/api/app";
import { createAuth } from "../../server/utils/create-auth";
import { StaleThreadStateError, ThreadLimitExceededError } from "../../server/utils/threads";

const BASE_URL = "http://localhost:3000";
const OWNER_ID = "owner";
const OTHER_ID = "other";
const THREAD_ID = "11111111-1111-4111-8111-111111111111";
const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../server/db/migrations/sqlite", import.meta.url),
);

const openApiOperationSchema = z.looseObject({
  description: z.string().optional(),
  parameters: z.array(z.looseObject({
    in: z.string().optional(),
    name: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
  responses: z.record(z.string(), z.looseObject({
    headers: z.record(z.string(), z.looseObject({
      description: z.string().optional(),
      schema: z.looseObject({ type: z.string().optional() }).optional(),
    })).optional(),
  })).optional(),
  tags: z.array(z.string()).optional(),
});

const openApiDocumentSchema = z.looseObject({
  paths: z.record(
    z.string(),
    z.record(z.string(), openApiOperationSchema),
  ),
});

function record(overrides: Partial<ThreadRecord> = {}): ThreadRecord {
  return {
    id: THREAD_ID,
    title: "相続した空き家の相談",
    summary: "相続登記と空き家管理について相談したい",
    revision: 0,
    createdAt: 1,
    updatedAt: 1,
    state: null,
    ...overrides,
  };
}

function authenticatedUser(headers: Headers) {
  const value = headers.get("authorization");
  return Promise.resolve(value?.startsWith("User ") ? value.slice(5) : null);
}

function request(
  path: string,
  options: {
    readonly body?: unknown;
    readonly headers?: Record<string, string>;
    readonly method?: "DELETE" | "GET" | "PATCH" | "POST";
    readonly userId?: string;
  } = {},
) {
  const method = options.method ?? "GET";
  return new Request(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(options.userId ? { authorization: `User ${options.userId}` } : {}),
      ...(method === "POST" || method === "PATCH"
        ? { "content-type": "application/json", origin: BASE_URL }
        : method === "DELETE" ? { origin: BASE_URL } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function setup(repositoryOverrides: Partial<ThreadRepository> = {}) {
  const stored = record();
  const repository = {
    create: async (_userId, input) => record({
      id: THREAD_ID,
      title: input.title ?? "New chat",
      summary: input.summary ?? "",
    }),
    delete: async (userId, id) => userId === OWNER_ID && id === THREAD_ID,
    get: async (userId, id) => userId === OWNER_ID && id === THREAD_ID ? stored : undefined,
    list: async userId => userId === OWNER_ID ? [stored] : [],
    update: async (userId, id, patch, expectedRevision) => {
      if (userId !== OWNER_ID || id !== THREAD_ID) return undefined;
      return record({
        title: patch.title ?? stored.title,
        revision: expectedRevision + 1,
      });
    },
    ...repositoryOverrides,
  } as const satisfies ThreadRepository;

  return createApiApp({
    getUserId: authenticatedUser,
    repository,
  });
}

let app: ReturnType<typeof setup>;

beforeEach(() => {
  app = setup();
});

describe("Elysia thread API", () => {
  it("serves all thread operations through the versioned API", async () => {
    const responses = await Promise.all([
      app.handle(request("/api/v1/threads", { userId: OWNER_ID })),
      app.handle(request("/api/v1/threads", {
        body: { title: "新規案件" },
        method: "POST",
        userId: OWNER_ID,
      })),
      app.handle(request(`/api/v1/threads/${THREAD_ID}`, { userId: OWNER_ID })),
      app.handle(request(`/api/v1/threads/${THREAD_ID}`, {
        body: { title: "更新案件" },
        headers: { "if-match": "\"0\"" },
        method: "PATCH",
        userId: OWNER_ID,
      })),
      app.handle(request(`/api/v1/threads/${THREAD_ID}`, {
        method: "DELETE",
        userId: OWNER_ID,
      })),
    ]);

    expect(responses.map(response => response.status)).toEqual([200, 201, 200, 200, 200]);
    expect(responses[1]?.headers.get("etag")).toBe("\"0\"");
    expect(responses[2]?.headers.get("etag")).toBe("\"0\"");
    expect(responses[3]?.headers.get("etag")).toBe("\"1\"");
    for (const response of responses) {
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("rejects unauthenticated requests", async () => {
    const response = await app.handle(request("/api/v1/threads"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Authentication is required" },
    });
  });

  it("does not expose another user's thread", async () => {
    const response = await app.handle(request(`/api/v1/threads/${THREAD_ID}`, {
      userId: OTHER_ID,
    }));

    expect(response.status).toBe(404);
  });

  it("rejects an invalid request body", async () => {
    const response = await app.handle(request("/api/v1/threads", {
      body: { title: "" },
      method: "POST",
      userId: OWNER_ID,
    }));
    const malformed = await app.handle(new Request(`${BASE_URL}/api/v1/threads`, {
      method: "POST",
      headers: {
        authorization: `User ${OWNER_ID}`,
        "content-type": "application/json",
        origin: BASE_URL,
      },
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: { code: "validation_error" } });
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get("cache-control")).toBe("no-store");
    expect(await malformed.json()).toEqual({
      error: { code: "validation_error", message: "JSON body is invalid" },
    });
  });

  it("requires JSON for create and update before schema validation", async () => {
    const wrongType = await app.handle(new Request(`${BASE_URL}/api/v1/threads`, {
      method: "POST",
      headers: {
        authorization: `User ${OWNER_ID}`,
        "content-type": "text/plain",
        origin: BASE_URL,
      },
      body: "案件",
    }));
    const missingType = await app.handle(new Request(`${BASE_URL}/api/v1/threads/${THREAD_ID}`, {
      method: "PATCH",
      headers: {
        authorization: `User ${OWNER_ID}`,
        "if-match": "\"0\"",
        origin: BASE_URL,
      },
      body: JSON.stringify({ title: "更新" }),
    }));

    expect(wrongType.status).toBe(415);
    expect(missingType.status).toBe(415);
  });

  it("requires a valid If-Match revision", async () => {
    const missing = await app.handle(request(`/api/v1/threads/${THREAD_ID}`, {
      body: { title: "更新" },
      method: "PATCH",
      userId: OWNER_ID,
    }));
    const invalid = await app.handle(request(`/api/v1/threads/${THREAD_ID}`, {
      body: { title: "更新" },
      headers: { "if-match": "0" },
      method: "PATCH",
      userId: OWNER_ID,
    }));

    expect(missing.status).toBe(428);
    expect(invalid.status).toBe(428);
  });

  it("rejects cross-origin mutations", async () => {
    const response = await app.handle(request("/api/v1/threads", {
      body: { title: "案件" },
      headers: { origin: "https://attacker.example" },
      method: "POST",
      userId: OWNER_ID,
    }));

    expect(response.status).toBe(403);
  });

  it("returns not found for a missing thread", async () => {
    const response = await app.handle(request(
      "/api/v1/threads/22222222-2222-4222-8222-222222222222",
      { userId: OWNER_ID },
    ));

    expect(response.status).toBe(404);
  });

  it("maps stale revisions to conflict", async () => {
    app = setup({
      update: async () => {
        throw new StaleThreadStateError();
      },
    });

    const response = await app.handle(request(`/api/v1/threads/${THREAD_ID}`, {
      body: { title: "更新" },
      headers: { "if-match": "\"0\"" },
      method: "PATCH",
      userId: OWNER_ID,
    }));

    expect(response.status).toBe(409);
  });

  it("maps thread quotas to too many requests", async () => {
    app = setup({
      create: async () => {
        throw new ThreadLimitExceededError();
      },
    });

    const response = await app.handle(request("/api/v1/threads", {
      body: { title: "上限確認" },
      method: "POST",
      userId: OWNER_ID,
    }));

    expect(response.status).toBe(429);
  });

  it("rejects a declared request body above the limit", async () => {
    const response = await app.handle(request("/api/v1/threads", {
      body: { title: "上限確認" },
      headers: { "content-length": String(1_048_577) },
      method: "POST",
      userId: OWNER_ID,
    }));

    expect(response.status).toBe(413);
  });

  it("rejects an actual request body above the limit without Content-Length", async () => {
    const response = await app.handle(new Request(`${BASE_URL}/api/v1/threads`, {
      method: "POST",
      headers: {
        authorization: `User ${OWNER_ID}`,
        "content-type": "application/json",
        origin: BASE_URL,
      },
      body: JSON.stringify({ title: "あ".repeat(400_000) }),
    }));

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("publishes the OpenAPI contract", async () => {
    const response = await app.handle(request("/api/v1/openapi/json"));
    const document = openApiDocumentSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(document.paths["/api/v1/threads"]?.get?.tags).toEqual(["Threads"]);
    const patch = document.paths["/api/v1/threads/{id}"]?.patch;
    expect(patch?.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ in: "header", name: "if-match", required: true }),
    ]));
    expect(patch?.description).toContain("ETag");
    expect(document.paths["/api/v1/threads"]?.post?.responses?.["201"]?.headers?.ETag)
      .toMatchObject({ schema: { type: "string" } });
    expect(document.paths["/api/v1/threads/{id}"]?.get?.responses?.["200"]?.headers?.ETag)
      .toMatchObject({ schema: { type: "string" } });
    expect(patch?.responses?.["200"]?.headers?.ETag)
      .toMatchObject({ schema: { type: "string" } });
  });

  it("serves the OpenAPI UI", async () => {
    const response = await app.handle(request("/api/v1/openapi"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("@scalar/api-reference@1.62.5/");
    expect(html).not.toContain("@scalar/api-reference@latest/");
  });
});

type IntegratedContext = Awaited<ReturnType<typeof setupIntegrated>>;
let integrated: IntegratedContext;

async function setupIntegrated() {
  const client = createClient({ url: ":memory:" });
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  const auth = createAuth({
    db: database,
    schema,
    baseURL: BASE_URL,
    secret: "unit-test-secret-key-0123456789",
  });
  const api = createApiApp({
    getUserId: async (headers) => (await auth.api.getSession({ headers }))?.user.id ?? null,
    repository: createThreadRepository(database),
  });

  return { api, auth };
}

function cookiesFrom(response: Response): string {
  return response.headers.getSetCookie()
    .map(cookie => cookie.split(";")[0])
    .join("; ");
}

async function signIn(auth: IntegratedContext["auth"], ip: string): Promise<string> {
  const response = await auth.handler(new Request(`${BASE_URL}/api/auth/sign-in/anonymous`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: "{}",
  }));
  expect(response.status).toBe(200);
  return cookiesFrom(response);
}

function authenticatedRequest(
  path: string,
  options: {
    readonly body?: unknown;
    readonly cookie?: string;
    readonly headers?: Record<string, string>;
    readonly method?: "GET" | "PATCH" | "POST";
  } = {},
) {
  const method = options.method ?? "GET";
  return new Request(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(method === "POST" || method === "PATCH"
        ? { "content-type": "application/json", origin: BASE_URL }
        : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function createIntegratedThread(
  cookie: string,
  input: { readonly summary?: string; readonly title: string },
) {
  const response = await integrated.api.handle(authenticatedRequest("/api/v1/threads", {
    body: input,
    cookie,
    method: "POST",
  }));
  expect(response.status).toBe(201);
  return {
    response,
    thread: ThreadResponseSchema.parse(await response.json()).thread,
  };
}

describe("Elysia thread API with Better Auth and libSQL", () => {
  beforeEach(async () => {
    integrated = await setupIntegrated();
  });

  it("enforces authentication and ownership through the public HTTP app", async () => {
    const unauthenticated = await integrated.api.handle(authenticatedRequest("/api/v1/threads", {
      body: { title: "案件" },
      method: "POST",
    }));
    const ownerCookie = await signIn(integrated.auth, "198.51.100.10");
    const otherCookie = await signIn(integrated.auth, "198.51.100.11");
    const { thread } = await createIntegratedThread(ownerCookie, { title: "所有者限定" });
    const otherUser = await integrated.api.handle(authenticatedRequest(
      `/api/v1/threads/${thread.id}`,
      { cookie: otherCookie },
    ));

    expect(unauthenticated.status).toBe(401);
    expect(otherUser.status).toBe(404);
  });

  it("normalizes summaries and returns the initial ETag", async () => {
    const cookie = await signIn(integrated.auth, "198.51.100.16");
    const { response, thread } = await createIntegratedThread(cookie, {
      title: "相続相談",
      summary: "  父から相続した\n\n空き家について   相談したい  ",
    });

    expect(thread.summary).toBe("父から相続した 空き家について 相談したい");
    expect(response.headers.get("etag")).toBe("\"0\"");
  });

  it("limits each anonymous user to 25 threads", async () => {
    const cookie = await signIn(integrated.auth, "198.51.100.18");
    for (let index = 0; index < 25; index += 1) {
      await createIntegratedThread(cookie, { title: `案件${index}` });
    }

    const response = await integrated.api.handle(authenticatedRequest("/api/v1/threads", {
      body: { title: "上限超過" },
      cookie,
      method: "POST",
    }));

    expect(response.status).toBe(429);
  }, 10_000);

  it("rejects stale revisions without overwriting newer history", async () => {
    const cookie = await signIn(integrated.auth, "198.51.100.14");
    const { thread } = await createIntegratedThread(cookie, { title: "競合確認" });
    const state = {
      session: { streamIndex: 10 },
      events: [{ type: "session.started", data: {} }],
    } as const;
    const first = await integrated.api.handle(authenticatedRequest(
      `/api/v1/threads/${thread.id}`,
      {
        body: { state },
        cookie,
        headers: { "if-match": "\"0\"" },
        method: "PATCH",
      },
    ));
    const stale = await integrated.api.handle(authenticatedRequest(
      `/api/v1/threads/${thread.id}`,
      {
        body: { state: { ...state, session: { streamIndex: 5 } } },
        cookie,
        headers: { "if-match": "\"0\"" },
        method: "PATCH",
      },
    ));

    expect(first.status).toBe(200);
    expect(first.headers.get("etag")).toBe("\"1\"");
    expect(stale.status).toBe(409);
  });

  it("rejects event histories above the contract limit", async () => {
    const cookie = await signIn(integrated.auth, "198.51.100.15");
    const { thread } = await createIntegratedThread(cookie, { title: "件数確認" });
    const response = await integrated.api.handle(authenticatedRequest(
      `/api/v1/threads/${thread.id}`,
      {
        body: {
          state: {
            session: { streamIndex: 1_001 },
            events: Array.from(
              { length: 1_001 },
              () => ({ type: "session.started", data: {} }),
            ),
          },
        },
        cookie,
        headers: { "if-match": "\"0\"" },
        method: "PATCH",
      },
    ));

    expect(response.status).toBe(400);
  });
});
