import { describe, expect, it, vi } from "vitest";
import {
  createThreadApiClient,
  shouldRetryThreadApiError,
  threadApiRetryDelay,
  ThreadApiClientError,
  type ThreadApiTransport,
} from "../../lib/api-client";

const THREAD_ID = "11111111-1111-4111-8111-111111111111";
const thread = {
  id: THREAD_ID,
  title: "相続した空き家の相談",
  summary: "相続登記と空き家管理について相談したい",
  revision: 1,
  createdAt: 1,
  updatedAt: 2,
  state: null,
} as const;
const { state: _state, ...threadSummary } = thread;

function transport(overrides: Partial<ThreadApiTransport> = {}): ThreadApiTransport {
  return {
    create: vi.fn().mockResolvedValue({ data: { thread }, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
    get: vi.fn().mockResolvedValue({ data: { thread }, error: null }),
    list: vi.fn().mockResolvedValue({ data: { threads: [thread] }, error: null }),
    update: vi.fn().mockResolvedValue({ data: { thread }, error: null }),
    ...overrides,
  } as const satisfies ThreadApiTransport;
}

describe("thread API client", () => {
  it("retries only typed retryable failures with a bounded backoff", () => {
    const retryableError = new ThreadApiClientError({
      code: "network_error",
      message: "Network unavailable",
      retryable: true,
      status: 0,
    });
    const conflictError = new ThreadApiClientError({
      code: "conflict",
      message: "Revision conflict",
      retryable: false,
      status: 409,
    });

    expect(shouldRetryThreadApiError(0, retryableError)).toBe(true);
    expect(shouldRetryThreadApiError(1, retryableError)).toBe(true);
    expect(shouldRetryThreadApiError(2, retryableError)).toBe(false);
    expect(shouldRetryThreadApiError(0, conflictError)).toBe(false);
    expect(shouldRetryThreadApiError(0, new Error("Unknown failure"))).toBe(false);
    expect(threadApiRetryDelay(0)).toBe(300);
    expect(threadApiRetryDelay(1)).toBe(900);
    expect(threadApiRetryDelay(2)).toBe(900);
  });

  it("returns validated plain data for query and mutation functions", async () => {
    const api = createThreadApiClient(transport());

    await expect(api.list()).resolves.toEqual([threadSummary]);
    await expect(api.get(THREAD_ID)).resolves.toEqual(thread);
    await expect(api.create({ title: "相談" })).resolves.toEqual(thread);
    await expect(api.update({
      expectedRevision: 0,
      id: THREAD_ID,
      input: { title: "更新" },
    })).resolves.toEqual(thread);
    await expect(api.delete(THREAD_ID)).resolves.toBeUndefined();
  });

  it("converts a plain API error into a typed non-retryable error", async () => {
    const api = createThreadApiClient(transport({
      update: vi.fn().mockResolvedValue({
        data: null,
        error: {
          status: 409,
          value: {
            error: {
              code: "conflict",
              message: "The thread was updated by another request",
            },
          },
        },
      }),
    }));

    const promise = api.update({
      expectedRevision: 0,
      id: THREAD_ID,
      input: { title: "更新" },
    });

    await expect(promise).rejects.toMatchObject({
      code: "conflict",
      retryable: false,
      status: 409,
    });
    await expect(promise).rejects.toBeInstanceOf(ThreadApiClientError);
  });

  it("marks infrastructure and network failures as retryable", async () => {
    const infrastructureApi = createThreadApiClient(transport({
      list: vi.fn().mockResolvedValue({
        data: null,
        error: {
          status: 500,
          value: {
            error: { code: "database_error", message: "Unavailable" },
          },
        },
      }),
    }));
    const networkApi = createThreadApiClient(transport({
      list: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    }));

    await expect(infrastructureApi.list()).rejects.toMatchObject({
      code: "database_error",
      retryable: true,
      status: 500,
    });
    await expect(networkApi.list()).rejects.toMatchObject({
      code: "network_error",
      retryable: true,
      status: 0,
    });
  });

  it("rejects a malformed success payload at the adapter boundary", async () => {
    const api = createThreadApiClient(transport({
      get: vi.fn().mockResolvedValue({
        data: { thread: { id: THREAD_ID } },
        error: null,
      }),
    }));

    await expect(api.get(THREAD_ID)).rejects.toMatchObject({
      code: "invalid_response",
      retryable: false,
      status: 200,
    });
  });
});
