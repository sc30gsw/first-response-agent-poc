import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AnalyzeCaseOutputSchema,
  DraftConsultationOutputSchema,
  ExpertSearchResultSchema,
} from "../../shared/tools/first-response";
import { AnalyzeCaseInputSchema } from "../../agent/tools/analyze_case";

const EMPTY_EVIDENCE = {
  matches: [],
  hasSufficientEvidence: false,
};

function report(reanalysisChanges: null | {
  resolvedUnknowns: string[];
  newFacts: string[];
}) {
  return {
    caseSummary: {
      category: "inheritance" as const,
      propertyState: ["空き家"],
      rights: ["共有"],
      stakeholders: ["相続人3名"],
      customerWish: "売却したい",
      currentProblem: "共有者1名と連絡が取れない",
      unknowns: ["登記状況"],
    },
    priority: {
      level: "early_check" as const,
      reasons: ["連絡不通"],
    },
    missingInfo: ["登記状況"],
    actionItems: ["登記事項証明書を確認する"],
    similarCases: EMPTY_EVIDENCE,
    guides: EMPTY_EVIDENCE,
    experts: EMPTY_EVIDENCE,
    humanEscalation: ["権利関係は専門家に確認する"],
    followUpQuestion: "登記状況は分かりますか？",
    reanalysisChanges,
  };
}

describe("初動分析ツールの公開出力契約", () => {
  it("AI Gateway向け入力スキーマのルートがobjectである", () => {
    expect(z.toJSONSchema(AnalyzeCaseInputSchema).type).toBe("object");
  });
  it("再分析では解消済みの不明点と新たに判明した事実を構造化して受け付ける", () => {
    const result = AnalyzeCaseOutputSchema.parse({
      analysisType: "reanalysis",
      analysisLabel: "再分析",
      categoryLabel: "相続・共有名義",
      priorityLabel: "早期の担当者確認",
      report: report({
        resolvedUnknowns: ["共有者は3名"],
        newFacts: ["共有者1名は海外在住"],
      }),
    });

    expect(result.report.reanalysisChanges).toEqual({
      resolvedUnknowns: ["共有者は3名"],
      newFacts: ["共有者1名は海外在住"],
    });
  });

  it("初回分析に再分析差分が混入した場合は拒否する", () => {
    const result = AnalyzeCaseOutputSchema.safeParse({
      analysisType: "initial",
      analysisLabel: "初回分析",
      categoryLabel: "相続・共有名義",
      priorityLabel: "早期の担当者確認",
      report: report({
        resolvedUnknowns: ["共有者は3名"],
        newFacts: [],
      }),
    });

    expect(result.success).toBe(false);
  });

  it("候補のネストした構造が壊れている場合は拒否する", () => {
    const result = ExpertSearchResultSchema.safeParse({
      hasSufficientEvidence: true,
      matches: [{ expert: { id: "EXP-001" }, score: 5, reasons: [] }],
    });

    expect(result.success).toBe(false);
  });
});

describe("相談依頼文ツールの公開出力契約", () => {
  it("下書き本文などのネストした必須項目が欠けている場合は拒否する", () => {
    const result = DraftConsultationOutputSchema.safeParse({
      ok: true,
      draft: {
        recipient: {
          id: "EXP-001",
          name: "相談担当",
          department: "案件支援部",
        },
        subject: "相談",
      },
    });

    expect(result.success).toBe(false);
  });
});
