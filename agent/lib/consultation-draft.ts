import { z } from "zod";
import { CASES, EXPERTS, GUIDES } from "#lib/domain/data";
import {
  CaseIdSchema,
  ConsultationDraftSchema,
  ExpertIdSchema,
  GuideIdSchema,
  PRIORITY_LABELS,
  type ConsultationDraft,
  PriorityLevelSchema,
} from "@/shared/tools/first-response";

// 相談依頼文の下書きに常に含める個人情報の注意（REQUIREMENT §7.15）
export const PII_NOTICE =
  "この下書きに実在の氏名・住所・連絡先などの個人情報を記載しないでください。共有前に固有の情報が含まれていないか必ず確認してください。";

export const ConsultationDraftInputSchema = z.object({
  expertId: ExpertIdSchema.describe(
    "The employee ID of an expert returned by analyze_case or search_experts.",
  ),
  caseOverview: z.string().min(1).describe(
    "A Japanese summary of the case. Do not include actual names, addresses, or contact details.",
  ),
  consultationPoints: z.array(z.string().min(1)).min(1)
    .describe("Points to be confirmed. Write each item in Japanese."),
  priorityLevel: PriorityLevelSchema.describe("The priority level returned by analyze_case."),
  referencedCaseIds: z.array(CaseIdSchema).default([])
    .describe("Referenced case IDs. Use only IDs returned by the tools."),
  referencedGuideIds: z.array(GuideIdSchema).default([])
    .describe("Referenced guide IDs. Use only IDs returned by the tools."),
});
export type ConsultationDraftInput = z.input<typeof ConsultationDraftInputSchema>;

function filterKnownIds<TId extends string>(ids: readonly TId[], knownIds: readonly TId[]) {
  const known = new Set(knownIds);
  return [...new Set(ids)].filter((id) => known.has(id));
}

function formatList(items: string[]) {
  if (items.length === 0) {
    return "- （該当なし）";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

// 相談依頼文の下書きを決定的に組み立てる（LLMは文面を生成しない）
export function buildConsultationDraft(input: ConsultationDraftInput) {
  const parsedInput = ConsultationDraftInputSchema.parse(input);
  const expert = EXPERTS.find((candidate) => candidate.id === parsedInput.expertId);
  if (!expert) {
    return {
      ok: false as const,
      message: `社員ID「${parsedInput.expertId}」は有識者データに存在しません。analyze_case または search_experts が返した候補の社員IDを指定してください。`,
    };
  }

  const referencedCaseIds = filterKnownIds(
    parsedInput.referencedCaseIds,
    CASES.map((record) => record.id),
  );
  const referencedGuideIds = filterKnownIds(
    parsedInput.referencedGuideIds,
    GUIDES.map((guide) => guide.id),
  );
  const priorityLabel = PRIORITY_LABELS[parsedInput.priorityLevel];

  const body = [
    `${expert.name}さん（${expert.department}）`,
    "",
    "お疲れさまです。複雑案件の初動対応について相談させてください。",
    "",
    "■ 案件概要",
    parsedInput.caseOverview,
    "",
    "■ 確認してほしい論点",
    formatList(parsedInput.consultationPoints),
    "",
    "■ 優先度",
    priorityLabel,
    "",
    "■ 参照した事例・ガイド",
    formatList([...referencedCaseIds, ...referencedGuideIds]),
    "",
    "■ 個人情報に関する注意",
    PII_NOTICE,
    "",
    "※ この下書きはAIが整理したものです。内容の最終確認と実際の連絡は担当者が行ってください。",
  ].join("\n");

  const draft: ConsultationDraft = ConsultationDraftSchema.parse({
    recipient: {
      id: expert.id,
      name: expert.name,
      department: expert.department,
    },
    subject: `【${priorityLabel}】複雑案件の初動相談のお願い`,
    body,
    priorityLevel: parsedInput.priorityLevel,
    priorityLabel,
    consultationPoints: parsedInput.consultationPoints,
    referencedCaseIds,
    referencedGuideIds,
    piiNotice: PII_NOTICE,
  });

  return { ok: true as const, draft };
}
