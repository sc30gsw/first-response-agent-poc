import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { library, promptOptions } from "../../app/_components/genui/library";
import { extractOpenUiBlock, hasOnlyOneOpenUiBlock } from "../../app/_components/genui/extract-openui";
import { validateAnalysisGenUi } from "../../app/_components/genui/validation";
import { AnalyzeCaseOutputSchema } from "../../shared/tools/first-response";

const output = AnalyzeCaseOutputSchema.parse({
  analysisType: "initial",
  analysisLabel: "初回分析",
  categoryLabel: "相続・共有名義",
  priorityLabel: "早期の担当者確認",
  report: {
    caseSummary: { category: "inheritance", propertyState: ["空き家"], rights: ["共有"], stakeholders: ["相続人3名"], customerWish: "売却したい", currentProblem: "連絡が取れない", unknowns: ["登記状況"] },
    priority: { level: "early_check", reasons: ["連絡不通"] },
    missingInfo: ["登記状況"],
    actionItems: ["登記事項証明書を確認する"],
    similarCases: { matches: [], hasSufficientEvidence: false },
    guides: { matches: [], hasSufficientEvidence: false },
    experts: { matches: [], hasSufficientEvidence: false },
    humanEscalation: ["権利関係は専門家に確認する"],
    followUpQuestion: "登記状況は分かりますか？",
    reanalysisChanges: null,
  },
});

const PROGRAM = `root = Report([summary, priority, missing, actions, cases, guides, experts, escalation])
summary = CaseSummary()
priority = PriorityBanner()
missing = MissingInfo()
actions = ActionItems()
cases = SimilarCases()
guides = Guides()
experts = Experts()
escalation = Escalation()`;

describe("OpenUI分析レポート", () => {
  it("未完了fenceをストリーミングブロックとして取り出す", () => {
    expect(extractOpenUiBlock("```openui\nroot = Report([summary])")).toEqual({ source: "root = Report([summary])", closed: false });
  });

  it("完成fenceだけを取り出し、単一ブロックを確認する", () => {
    const text = `\`\`\`openui\n${PROGRAM}\n\`\`\``;
    expect(extractOpenUiBlock(text)).toEqual({ source: `${PROGRAM}\n`, closed: true });
    expect(hasOnlyOneOpenUiBlock(text)).toBe(true);
  });

  it("canonical programを受け入れ、逐次prefixは完了検証前に扱える", () => {
    expect(validateAnalysisGenUi(PROGRAM, output)).toEqual({ ok: true });
    expect(extractOpenUiBlock(`\`\`\`openui\n${PROGRAM.slice(0, 42)}`)?.closed).toBe(false);
  });

  it("必須ブロックの欠落と不正なNoteを拒否する", () => {
    expect(validateAnalysisGenUi(PROGRAM.replace("experts = Experts()\n", ""), output).ok).toBe(false);
    expect(validateAnalysisGenUi(`${PROGRAM}\nnote = Note("CASE-INH-001")`, output).ok).toBe(false);
  });

  it("コミット済みの生成promptをライブラリ正本と同期する", () => {
    expect(readFileSync("agent/generated/genui-system-prompt.txt", "utf8").trimEnd())
      .toBe(library.prompt(promptOptions));
  });
});
