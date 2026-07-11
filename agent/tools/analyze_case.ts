import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  CASE_CATEGORY_LABELS,
  InitialReportSchema,
  PRIORITY_LABELS,
  buildEvidenceBundle,
  parseCaseQuery,
} from "#lib/domain";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "構造化抽出した案件情報から初動レポートを作成する。優先度・類似事例・社内初動ガイド・有識者候補はこのツールが決定的に確定して返す。順位・スコア・根拠を変更してはならない。新しい相談の初回分析と、追加情報を反映した再分析の両方で使う。",
  inputSchema: z.object({
    analysisType: z
      .enum(["initial", "reanalysis"])
      .describe("初回分析は initial、追加情報を反映した再分析は reanalysis"),
    ...CaseQueryInputSchema.shape,
    stakeholders: z
      .array(z.string())
      .default([])
      .describe("関係者（例: 相続人3名、入居者。個人が特定できる情報は含めない）"),
    customerWish: z.string().min(1).describe("顧客の希望。読み取れない場合は「不明」"),
    currentProblem: z.string().min(1).describe("現在の問題。読み取れない場合は「不明」"),
    unknowns: z.array(z.string()).default([]).describe("入力から読み取れない不明点"),
    missingInfo: z
      .array(z.string())
      .max(5)
      .default([])
      .describe("入力から判断できない重要事項（最大5件）"),
    actionItems: z
      .array(z.string())
      .max(7)
      .default([])
      .describe(
        "優先順位付きの初動確認事項（最大7件）。事実確認と相談先の整理に限定し、法的結論や手続判断を書かない",
      ),
    humanEscalation: z
      .array(z.string())
      .default([])
      .describe("人間または専門家へ確認すべき事項（法務・税務・査定・契約に関わる論点は必ず含める）"),
    followUpQuestion: z.string().min(1).describe("次に利用者へ確認する質問（1つ）"),
  }),
  outputSchema: z.object({
    analysisType: z.enum(["initial", "reanalysis"]),
    analysisLabel: z.string(),
    categoryLabel: z.string().nullable(),
    priorityLabel: z.string(),
    report: InitialReportSchema,
  }),
  execute(input) {
    const query = parseCaseQuery({
      category: input.category,
      tags: input.tags,
      keyIssues: input.keyIssues,
      propertyState: input.propertyState,
      rights: input.rights,
    });
    const evidence = buildEvidenceBundle(query);

    const report = InitialReportSchema.parse({
      caseSummary: {
        category: query.category,
        propertyState: query.propertyState,
        rights: query.rights,
        stakeholders: input.stakeholders,
        customerWish: input.customerWish,
        currentProblem: input.currentProblem,
        unknowns: input.unknowns,
      },
      priority: evidence.priority,
      missingInfo: input.missingInfo,
      actionItems: input.actionItems,
      similarCases: evidence.similarCases,
      guides: evidence.guides,
      experts: evidence.experts,
      humanEscalation: input.humanEscalation,
      followUpQuestion: input.followUpQuestion,
    });

    return {
      analysisType: input.analysisType,
      analysisLabel: input.analysisType === "initial" ? "初回分析" : "再分析",
      categoryLabel: query.category === null ? null : CASE_CATEGORY_LABELS[query.category],
      priorityLabel: PRIORITY_LABELS[report.priority.level],
      report,
    };
  },
});
