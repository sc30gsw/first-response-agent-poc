import { z } from "zod";
import { CaseCategorySchema } from "#lib/domain";

// 検索系ツール共通の入力スキーマ（ドメイン層 CaseQuery と同形。モデル向けの説明付き）
export const CaseQueryInputSchema = z.object({
  category: CaseCategorySchema.nullable()
    .default(null)
    .describe(
      "案件カテゴリ。inheritance=相続・共有名義 / stigmatized=事故・告知事項 / non_rebuildable=再建築不可・老朽化。判定できない場合は null",
    ),
  tags: z
    .array(z.string())
    .default([])
    .describe(
      "相談内容に該当するタグ。initial-triage スキルの語彙表と完全一致で照合される。安全・緊急に関わる記載は相談文の表現のまま追加してよい",
    ),
  keyIssues: z
    .array(z.string())
    .default([])
    .describe("主な論点。initial-triage スキルの語彙表から選ぶ"),
  propertyState: z
    .array(z.string())
    .default([])
    .describe("物件状態。initial-triage スキルの語彙表から選ぶ"),
  rights: z
    .array(z.string())
    .default([])
    .describe("権利関係。initial-triage スキルの語彙表から選ぶ"),
});

export type CaseQueryInput = z.infer<typeof CaseQueryInputSchema>;
