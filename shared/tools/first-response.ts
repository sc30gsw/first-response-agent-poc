// 初動対応エージェントのツール出力型（agent/lib/domain/types.ts のZodスキーマと同形のUI用プレーン型）
// weather と同じく shared/ 配下にプレーンな interface として複製する（REQUIREMENT §7.13）

export type CaseCategory = "inheritance" | "stigmatized" | "non_rebuildable";

export const CASE_CATEGORY_LABELS = {
  inheritance: "相続・共有名義",
  stigmatized: "事故・告知事項",
  non_rebuildable: "再建築不可・老朽化",
} as const satisfies Record<CaseCategory, string>;

export type PriorityLevel = "safety_first" | "early_check" | "normal" | "needs_review";

export type MatchSignal =
  | "category"
  | "tag"
  | "keyIssue"
  | "propertyState"
  | "rights"
  | "specialty"
  | "strength";

export interface MatchReason {
  signal: MatchSignal;
  matched: string[];
  points: number;
}

export interface CaseRecord {
  id: string;
  category: CaseCategory;
  summary: string;
  keyIssues: string[];
  propertyState: string[];
  rights: string[];
  initialResponse: string;
  outcome: string;
  cautions: string;
  handlerId: string;
  tags: string[];
}

export interface Expert {
  id: string;
  name: string;
  department: string;
  specialties: CaseCategory[];
  relatedCaseCount: number;
  strengths: string[];
}

export interface Guide {
  id: string;
  title: string;
  area: string;
  targetCategories: CaseCategory[];
  checkItems: string[];
  cautions: string[];
  expertConsultationConditions: string[];
  tags: string[];
}

export interface SimilarCaseMatch {
  case: CaseRecord;
  score: number;
  reasons: MatchReason[];
}

export interface GuideMatch {
  guide: Guide;
  score: number;
  reasons: MatchReason[];
}

export interface ExpertMatch {
  expert: Expert;
  score: number;
  reasons: MatchReason[];
  recommendation: string;
}

export interface SimilarCaseSearchResult {
  matches: SimilarCaseMatch[];
  hasSufficientEvidence: boolean;
}

export interface GuideSearchResult {
  matches: GuideMatch[];
  hasSufficientEvidence: boolean;
}

export interface ExpertSearchResult {
  matches: ExpertMatch[];
  hasSufficientEvidence: boolean;
}

export interface PriorityAssessment {
  level: PriorityLevel;
  reasons: string[];
}

export interface CaseSummary {
  category: CaseCategory | null;
  propertyState: string[];
  rights: string[];
  stakeholders: string[];
  customerWish: string;
  currentProblem: string;
  unknowns: string[];
}

export interface InitialReport {
  caseSummary: CaseSummary;
  priority: PriorityAssessment;
  missingInfo: string[];
  actionItems: string[];
  similarCases: SimilarCaseSearchResult;
  guides: GuideSearchResult;
  experts: ExpertSearchResult;
  humanEscalation: string[];
  followUpQuestion: string;
}

export interface AnalyzeCaseOutput {
  analysisType: "initial" | "reanalysis";
  analysisLabel: string;
  categoryLabel: string | null;
  priorityLabel: string;
  report: InitialReport;
}

export interface ConsultationDraft {
  recipient: {
    id: string;
    name: string;
    department: string;
  };
  subject: string;
  body: string;
  priorityLevel: PriorityLevel;
  priorityLabel: string;
  consultationPoints: string[];
  referencedCaseIds: string[];
  referencedGuideIds: string[];
  piiNotice: string;
}

export type DraftConsultationOutput =
  | { ok: true; draft: ConsultationDraft }
  | { ok: false; message: string };
