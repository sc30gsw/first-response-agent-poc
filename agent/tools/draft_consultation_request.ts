import { defineTool } from "eve/tools";
import { z } from "zod";
import { PriorityLevelSchema } from "#lib/domain";
import { ConsultationDraftSchema, buildConsultationDraft } from "#lib/consultation-draft";

export default defineTool({
  description:
    "選択された有識者への社内向け相談依頼文の下書きを生成する。実際のメール・チャット送信は行わず、コピー可能な下書きだけを返す。expertId は analyze_case / search_experts が返した候補の社員IDのみ指定できる。",
  inputSchema: z.object({
    expertId: z
      .string()
      .min(1)
      .describe("analyze_case または search_experts が返した有識者候補の社員ID"),
    caseOverview: z
      .string()
      .min(1)
      .describe("案件概要の要約。個人情報（実在の氏名・住所・連絡先）を含めない"),
    consultationPoints: z
      .array(z.string().min(1))
      .min(1)
      .describe("確認してほしい論点"),
    priorityLevel: PriorityLevelSchema.describe("analyze_case が返した優先度レベル"),
    referencedCaseIds: z
      .array(z.string())
      .default([])
      .describe("参照した事例ID。ツールが返したIDのみ指定できる"),
    referencedGuideIds: z
      .array(z.string())
      .default([])
      .describe("参照したガイドID。ツールが返したIDのみ指定できる"),
  }),
  outputSchema: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), draft: ConsultationDraftSchema }),
    z.object({ ok: z.literal(false), message: z.string() }),
  ]),
  execute(input) {
    return buildConsultationDraft(input);
  },
});
