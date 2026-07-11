import { z } from "zod";
import { CASES, EXPERTS, GUIDES, PRIORITY_LABELS, PriorityLevelSchema } from "#lib/domain";
import type { PriorityLevel } from "#lib/domain";

// 相談依頼文の下書きに常に含める個人情報の注意（REQUIREMENT §7.15）
export const PII_NOTICE =
  "この下書きに実在の氏名・住所・連絡先などの個人情報を記載しないでください。共有前に固有の情報が含まれていないか必ず確認してください。";

export const ConsultationDraftSchema = z.object({
  recipient: z.object({
    id: z.string(),
    name: z.string(),
    department: z.string(),
  }),
  subject: z.string(),
  body: z.string(),
  priorityLevel: PriorityLevelSchema,
  priorityLabel: z.string(),
  consultationPoints: z.array(z.string()),
  referencedCaseIds: z.array(z.string()),
  referencedGuideIds: z.array(z.string()),
  piiNotice: z.string(),
});
export type ConsultationDraft = z.infer<typeof ConsultationDraftSchema>;

export type ConsultationDraftInput = {
  expertId: string;
  caseOverview: string;
  consultationPoints: string[];
  priorityLevel: PriorityLevel;
  referencedCaseIds: string[];
  referencedGuideIds: string[];
};

function filterKnownIds(ids: string[], knownIds: string[]) {
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
  const expert = EXPERTS.find((candidate) => candidate.id === input.expertId);
  if (!expert) {
    return {
      ok: false as const,
      message: `社員ID「${input.expertId}」は有識者データに存在しません。analyze_case または search_experts が返した候補の社員IDを指定してください。`,
    };
  }

  const referencedCaseIds = filterKnownIds(
    input.referencedCaseIds,
    CASES.map((record) => record.id),
  );
  const referencedGuideIds = filterKnownIds(
    input.referencedGuideIds,
    GUIDES.map((guide) => guide.id),
  );
  const priorityLabel = PRIORITY_LABELS[input.priorityLevel];

  const body = [
    `${expert.name}さん（${expert.department}）`,
    "",
    "お疲れさまです。複雑案件の初動対応について相談させてください。",
    "",
    "■ 案件概要",
    input.caseOverview,
    "",
    "■ 確認してほしい論点",
    formatList(input.consultationPoints),
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

  const draft: ConsultationDraft = {
    recipient: {
      id: expert.id,
      name: expert.name,
      department: expert.department,
    },
    subject: `【${priorityLabel}】複雑案件の初動相談のお願い`,
    body,
    priorityLevel: input.priorityLevel,
    priorityLabel,
    consultationPoints: input.consultationPoints,
    referencedCaseIds,
    referencedGuideIds,
    piiNotice: PII_NOTICE,
  };

  return { ok: true as const, draft };
}
