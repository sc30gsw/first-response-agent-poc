import { describe, expect, it } from "vitest";
import { ThreadRecordSchema } from "../../shared/types/thread";

describe("スレッドAPIの公開レスポンス契約", () => {
  it("revisionやsummaryを含むスレッドを受け付ける", () => {
    const result = ThreadRecordSchema.safeParse({
      id: "thread-1",
      title: "相続した空き家の相談",
      summary: "共有者の一人と連絡が取れない相続空き家。",
      revision: 2,
      createdAt: 1,
      updatedAt: 2,
      state: null,
    });

    expect(result.success).toBe(true);
  });

  it("revisionの型が壊れたレスポンスを拒否する", () => {
    const result = ThreadRecordSchema.safeParse({
      id: "thread-1",
      title: "相談",
      summary: "要約",
      revision: "2",
      createdAt: 1,
      updatedAt: 2,
      state: null,
    });

    expect(result.success).toBe(false);
  });
});
