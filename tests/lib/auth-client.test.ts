import { describe, expect, it, vi } from "vitest";
import {
  AnonymousAuthError,
  createAnonymousAuthAdapter,
  type AnonymousAuthSdk,
} from "../../lib/auth-client";

function sdk(overrides: Partial<AnonymousAuthSdk> = {}): AnonymousAuthSdk {
  return {
    deleteAnonymousUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInAnonymous: vi.fn().mockResolvedValue({ data: {}, error: null }),
    ...overrides,
  };
}

describe("anonymous auth adapter", () => {
  it("resolves a successful SDK operation for the TanStack mutation boundary", async () => {
    const adapter = createAnonymousAuthAdapter(sdk());

    await expect(adapter.signInAnonymous()).resolves.toBeUndefined();
    await expect(adapter.deleteAnonymousUser()).resolves.toBeUndefined();
  });

  it("rejects an SDK error as a typed expected failure", async () => {
    const adapter = createAnonymousAuthAdapter(sdk({
      signInAnonymous: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Unauthorized", status: 401, statusText: "Unauthorized" },
      }),
    }));

    const operation = adapter.signInAnonymous();
    await expect(operation).rejects.toBeInstanceOf(AnonymousAuthError);
    await expect(operation).rejects.toMatchObject({
      operation: "anonymous-sign-in",
      reason: "sdk_error",
      status: 401,
    });
  });

  it("rejects a thrown SDK failure as a typed network failure", async () => {
    const cause = new TypeError("fetch failed");
    const adapter = createAnonymousAuthAdapter(sdk({
      deleteAnonymousUser: vi.fn().mockRejectedValue(cause),
    }));

    const operation = adapter.deleteAnonymousUser();
    await expect(operation).rejects.toBeInstanceOf(AnonymousAuthError);
    await expect(operation).rejects.toMatchObject({
      cause,
      operation: "anonymous-user-delete",
      reason: "network_error",
    });
  });
});
