import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { Thread, ThreadInsert } from "../../server/db/schema/threads";
import type {
  CreateThreadData,
  PatchThreadData,
  ThreadIdParams,
} from "../../server/schemas/threads";
import {
  ThreadRecordSchema,
  type ThreadRecord,
  type ThreadState,
  type ThreadSummary,
} from "../../shared/types/thread";

const THREAD_ID = "11111111-1111-4111-8111-111111111111";

describe("スレッドAPIの公開レスポンス契約", () => {
  it("revisionやsummaryを含むスレッドを受け付ける", () => {
    const result = ThreadRecordSchema.safeParse({
      id: THREAD_ID,
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
      id: THREAD_ID,
      title: "相談",
      summary: "要約",
      revision: "2",
      createdAt: 1,
      updatedAt: 2,
      state: null,
    });

    expect(result.success).toBe(false);
  });

  it("DB行と公開DTOで共有するscalar型をDrizzle schemaから導出する", () => {
    expectTypeOf<ThreadSummary["id"]>().toEqualTypeOf<Thread["id"]>();
    expectTypeOf<ThreadSummary["title"]>().toEqualTypeOf<Thread["title"]>();
    expectTypeOf<ThreadSummary["summary"]>().toEqualTypeOf<Thread["summary"]>();
    expectTypeOf<ThreadSummary["revision"]>().toEqualTypeOf<Thread["stateVersion"]>();
    expectTypeOf<ThreadIdParams["id"]>().toEqualTypeOf<Thread["id"]>();
    expectTypeOf<z.output<typeof ThreadRecordSchema>>().toMatchTypeOf<ThreadRecord>();
    expectTypeOf<ThreadRecord>().toMatchTypeOf<z.output<typeof ThreadRecordSchema>>();
    expectTypeOf<CreateThreadData>().toEqualTypeOf<
      Partial<Pick<ThreadInsert, "summary" | "title">>
    >();
    expectTypeOf<PatchThreadData>().toMatchTypeOf<
      Partial<Pick<Thread, "title"> & { state: ThreadState }>
    >();
    expectTypeOf<
      Partial<Pick<Thread, "title"> & { state: ThreadState }>
    >().toMatchTypeOf<PatchThreadData>();
  });
});
