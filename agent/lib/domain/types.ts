import { z } from "zod";

// 案件カテゴリ（事例・有識者・ガイドで共有する3領域）
export const CASE_CATEGORIES = ["inheritance", "stigmatized", "non_rebuildable"] as const;
export const CaseCategorySchema = z.enum(CASE_CATEGORIES);
export type CaseCategory = z.infer<typeof CaseCategorySchema>;

export const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = {
  inheritance: "相続・共有名義",
  stigmatized: "事故・告知事項",
  non_rebuildable: "再建築不可・老朽化",
};

// 優先度（REQUIREMENT §7.6：緊急性の断定ではなく整理の目安）
export const PRIORITY_LEVELS = ["safety_first", "early_check", "normal", "needs_review"] as const;
export const PriorityLevelSchema = z.enum(PRIORITY_LEVELS);
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  safety_first: "安全確認を優先",
  early_check: "早期の担当者確認",
  normal: "通常確認",
  needs_review: "要確認",
};

// 過去事例（REQUIREMENT §7.9）
export const CaseRecordSchema = z.object({
  id: z.string().min(1),
  category: CaseCategorySchema,
  summary: z.string().min(1),
  keyIssues: z.array(z.string().min(1)).min(1),
  propertyState: z.array(z.string().min(1)),
  rights: z.array(z.string().min(1)),
  initialResponse: z.string().min(1),
  outcome: z.string().min(1),
  cautions: z.string().min(1),
  handlerId: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
});
export type CaseRecord = z.infer<typeof CaseRecordSchema>;

// 有識者（REQUIREMENT §7.11）
export const ExpertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  specialties: z.array(CaseCategorySchema).min(1),
  relatedCaseCount: z.number().int().nonnegative(),
  strengths: z.array(z.string().min(1)).min(1),
});
export type Expert = z.infer<typeof ExpertSchema>;

// 社内初動ガイド（REQUIREMENT §7.10）
export const GuideSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  area: z.string().min(1),
  targetCategories: z.array(CaseCategorySchema).min(1),
  checkItems: z.array(z.string().min(1)).min(1),
  cautions: z.array(z.string().min(1)).min(1),
  expertConsultationConditions: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)).min(1),
});
export type Guide = z.infer<typeof GuideSchema>;

// 抽出済み案件情報（ドメイン境界の入力：REQUIREMENT §15.1）
export const CaseQuerySchema = z.object({
  category: CaseCategorySchema.nullable().default(null),
  tags: z.array(z.string()).default([]),
  keyIssues: z.array(z.string()).default([]),
  propertyState: z.array(z.string()).default([]),
  rights: z.array(z.string()).default([]),
});
export type CaseQuery = z.infer<typeof CaseQuerySchema>;

// 検索の根拠メタデータ
export const MATCH_SIGNALS = [
  "category",
  "tag",
  "keyIssue",
  "propertyState",
  "rights",
  "specialty",
  "strength",
] as const;
export const MatchSignalSchema = z.enum(MATCH_SIGNALS);
export type MatchSignal = z.infer<typeof MatchSignalSchema>;

export const MatchReasonSchema = z.object({
  signal: MatchSignalSchema,
  matched: z.array(z.string()),
  points: z.number(),
});
export type MatchReason = z.infer<typeof MatchReasonSchema>;

export const SimilarCaseMatchSchema = z.object({
  case: CaseRecordSchema,
  score: z.number(),
  reasons: z.array(MatchReasonSchema),
});
export type SimilarCaseMatch = z.infer<typeof SimilarCaseMatchSchema>;

export const GuideMatchSchema = z.object({
  guide: GuideSchema,
  score: z.number(),
  reasons: z.array(MatchReasonSchema),
});
export type GuideMatch = z.infer<typeof GuideMatchSchema>;

export const ExpertMatchSchema = z.object({
  expert: ExpertSchema,
  score: z.number(),
  reasons: z.array(MatchReasonSchema),
  recommendation: z.string(),
});
export type ExpertMatch = z.infer<typeof ExpertMatchSchema>;

export const SimilarCaseSearchResultSchema = z.object({
  matches: z.array(SimilarCaseMatchSchema),
  hasSufficientEvidence: z.boolean(),
});
export type SimilarCaseSearchResult = z.infer<typeof SimilarCaseSearchResultSchema>;

export const GuideSearchResultSchema = z.object({
  matches: z.array(GuideMatchSchema),
  hasSufficientEvidence: z.boolean(),
});
export type GuideSearchResult = z.infer<typeof GuideSearchResultSchema>;

export const ExpertSearchResultSchema = z.object({
  matches: z.array(ExpertMatchSchema),
  hasSufficientEvidence: z.boolean(),
});
export type ExpertSearchResult = z.infer<typeof ExpertSearchResultSchema>;

export const PriorityAssessmentSchema = z.object({
  level: PriorityLevelSchema,
  reasons: z.array(z.string()),
});
export type PriorityAssessment = z.infer<typeof PriorityAssessmentSchema>;

// 初動レポート構造（REQUIREMENT §7.4）
export const CaseSummarySchema = z.object({
  category: CaseCategorySchema.nullable(),
  propertyState: z.array(z.string()),
  rights: z.array(z.string()),
  stakeholders: z.array(z.string()),
  customerWish: z.string(),
  currentProblem: z.string(),
  unknowns: z.array(z.string()),
});
export type CaseSummary = z.infer<typeof CaseSummarySchema>;

export const InitialReportSchema = z.object({
  caseSummary: CaseSummarySchema,
  priority: PriorityAssessmentSchema,
  missingInfo: z.array(z.string()).max(5),
  actionItems: z.array(z.string()).max(7),
  similarCases: SimilarCaseSearchResultSchema,
  guides: GuideSearchResultSchema,
  experts: ExpertSearchResultSchema,
  humanEscalation: z.array(z.string()),
  followUpQuestion: z.string(),
});
export type InitialReport = z.infer<typeof InitialReportSchema>;

// 決定的検索の根拠バンドル（LLMが説明文を付ける前の確定部分）
export type EvidenceBundle = {
  priority: PriorityAssessment;
  similarCases: SimilarCaseSearchResult;
  guides: GuideSearchResult;
  experts: ExpertSearchResult;
};
