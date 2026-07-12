import { Result } from "better-result";
import { describe, expect, it } from "vitest";
import { validateSameOrigin } from "../../server/utils/http-security";

describe("validateSameOrigin", () => {
  it("allows a matching Origin header", () => {
    const result = validateSameOrigin(new Request("http://localhost:3000/eve/v1/session", {
      headers: { origin: "http://localhost:3000" },
      method: "POST",
    }));

    expect(Result.isError(result)).toBe(false);
  });

  it("falls back to a matching Referer when Origin is absent", () => {
    const result = validateSameOrigin(new Request("http://localhost:3000/eve/v1/session", {
      headers: { referer: "http://localhost:3000/chat/thread-id" },
      method: "POST",
    }));

    expect(Result.isError(result)).toBe(false);
  });

  it("allows the configured public origin behind the Eve proxy", () => {
    const result = validateSameOrigin(new Request("http://127.0.0.1:54923/eve/v1/session", {
      headers: { referer: "http://localhost:3000/chat/thread-id" },
      method: "POST",
    }), "http://localhost:3000");

    expect(Result.isError(result)).toBe(false);
  });

  it("rejects a cross-origin Referer", () => {
    const result = validateSameOrigin(new Request("http://localhost:3000/eve/v1/session", {
      headers: { referer: "https://attacker.example.test/chat/thread-id" },
      method: "POST",
    }));

    expect(Result.isError(result)).toBe(true);
  });

  it("rejects a malformed Referer", () => {
    const result = validateSameOrigin(new Request("http://localhost:3000/eve/v1/session", {
      headers: { referer: "not a URL" },
      method: "POST",
    }));

    expect(Result.isError(result)).toBe(true);
  });

  it("rejects a request with neither Origin nor Referer", () => {
    const result = validateSameOrigin(new Request("http://localhost:3000/eve/v1/session", {
      method: "POST",
    }));

    expect(Result.isError(result)).toBe(true);
  });
});
