import { Result } from "better-result";
import { describe, expect, it } from "vitest";
import { validateSameOrigin } from "../../server/utils/http-security";

describe("validateSameOrigin", () => {
  it("allows a browser origin forwarded by the loopback Eve development proxy", () => {
    const result = validateSameOrigin(new Request("http://127.0.0.1:2000/eve/v1/session", {
      headers: {
        origin: "http://127.0.0.1:3000",
        "x-forwarded-host": "127.0.0.1:3000",
        "x-forwarded-proto": "http",
      },
      method: "POST",
    }));

    expect(Result.isError(result)).toBe(false);
  });

  it("does not trust forwarded origin headers on a non-loopback request", () => {
    const result = validateSameOrigin(new Request("https://agent.example.test/eve/v1/session", {
      headers: {
        origin: "https://attacker.example.test",
        "x-forwarded-host": "attacker.example.test",
        "x-forwarded-proto": "https",
      },
      method: "POST",
    }));

    expect(Result.isError(result)).toBe(true);
  });
});
