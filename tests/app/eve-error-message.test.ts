import { ClientError } from "eve/client";
import { describe, expect, it } from "vitest";
import { eveErrorMessage } from "../../app/_components/eve-error-message";

describe("eveErrorMessage", () => {
  it("通常のレート上限をPoC向けメッセージで案内する", () => {
    const error = new ClientError(429, JSON.stringify({
      code: "rate_limit_exceeded",
      error: "Too many requests",
      ok: false,
      retryAfter: 37,
    }));

    const message = eveErrorMessage(error, "送信に失敗しました");
    expect(message).toContain("送信上限");
    expect(message).toContain("37秒");
  });

  it("実行中leaseを通常のレート上限と区別する", () => {
    const error = new ClientError(429, JSON.stringify({
      code: "concurrent_turn_limit",
      error: "Another request is still running",
      ok: false,
    }));

    const message = eveErrorMessage(error, "送信に失敗しました");
    expect(message).toContain("同時に1件のみ");
    expect(message).toContain("待機中");
  });

  it("未知のエラーでは呼び出し元のメッセージを保つ", () => {
    expect(eveErrorMessage(new Error("network"), "送信に失敗しました"))
      .toBe("送信に失敗しました");
  });
});
