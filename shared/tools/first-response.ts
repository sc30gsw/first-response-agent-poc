import { z } from "zod";

export const CASE_CATEGORIES = [
  "inheritance",
  "stigmatized",
  "non_rebuildable",
] as const satisfies readonly string[];
export const CaseCategorySchema = z.enum(CASE_CATEGORIES);
export type CaseCategory = z.infer<typeof CaseCategorySchema>;

export const CASE_CATEGORY_LABELS = {
  inheritance: "相続・共有名義",
  stigmatized: "事故・告知事項",
  non_rebuildable: "再建築不可・老朽化",
} as const satisfies Record<CaseCategory, string>;

export const PRIORITY_LEVELS = [
  "safety_first",
  "early_check",
  "normal",
  "needs_review",
] as const satisfies readonly string[];
export const PriorityLevelSchema = z.enum(PRIORITY_LEVELS);
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

export const PRIORITY_LABELS = {
  safety_first: "安全確認を優先",
  early_check: "早期の担当者確認",
  normal: "通常確認",
  needs_review: "要確認",
} as const satisfies Record<PriorityLevel, string>;

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

export const ExpertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  specialties: z.array(CaseCategorySchema).min(1),
  relatedCaseCount: z.number().int().nonnegative(),
  strengths: z.array(z.string().min(1)).min(1),
});
export type Expert = z.infer<typeof ExpertSchema>;

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

export const CaseQuerySchema = z.object({
  category: CaseCategorySchema.nullable().default(null),
  tags: z.array(z.string()).default([]),
  keyIssues: z.array(z.string()).default([]),
  propertyState: z.array(z.string()).default([]),
  rights: z.array(z.string()).default([]),
});
export type CaseQuery = z.infer<typeof CaseQuerySchema>;

export const MATCH_SIGNALS = [
  "category",
  "tag",
  "keyIssue",
  "propertyState",
  "rights",
  "specialty",
  "strength",
] as const satisfies readonly string[];
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

export const ReanalysisChangesSchema = z.object({
  resolvedUnknowns: z.array(z.string().min(1)).max(5),
  newFacts: z.array(z.string().min(1)).max(7),
});
export type ReanalysisChanges = z.infer<typeof ReanalysisChangesSchema>;

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
  reanalysisChanges: ReanalysisChangesSchema.nullable(),
});
export type InitialReport = z.infer<typeof InitialReportSchema>;

const analyzeCaseOutputBaseShape = {
  analysisLabel: z.string(),
  categoryLabel: z.string().nullable(),
  priorityLabel: z.string(),
};

export const AnalyzeCaseOutputSchema = z.discriminatedUnion("analysisType", [
  z.object({
    analysisType: z.literal("initial"),
    ...analyzeCaseOutputBaseShape,
    report: InitialReportSchema.extend({ reanalysisChanges: z.null() }),
  }),
  z.object({
    analysisType: z.literal("reanalysis"),
    ...analyzeCaseOutputBaseShape,
    report: InitialReportSchema.extend({ reanalysisChanges: ReanalysisChangesSchema }),
  }),
]);
export type AnalyzeCaseOutput = z.infer<typeof AnalyzeCaseOutputSchema>;

export const ConsultationDraftSchema = z.object({
  recipient: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    department: z.string().min(1),
  }),
  subject: z.string().min(1),
  body: z.string().min(1),
  priorityLevel: PriorityLevelSchema,
  priorityLabel: z.string().min(1),
  consultationPoints: z.array(z.string().min(1)),
  referencedCaseIds: z.array(z.string().min(1)),
  referencedGuideIds: z.array(z.string().min(1)),
  piiNotice: z.string().min(1),
});
export type ConsultationDraft = z.infer<typeof ConsultationDraftSchema>;

export const DraftConsultationOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), draft: ConsultationDraftSchema }),
  z.object({ ok: z.literal(false), message: z.string().min(1) }),
]);
export type DraftConsultationOutput = z.infer<typeof DraftConsultationOutputSchema>;

export type EvidenceBundle = {
  priority: PriorityAssessment;
  similarCases: SimilarCaseSearchResult;
  guides: GuideSearchResult;
  experts: ExpertSearchResult;
};
