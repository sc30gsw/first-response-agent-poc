import { CASES, EXPERTS, GUIDES } from "#lib/domain/data";
import {
  CASE_CATEGORY_LABELS,
  CaseQuerySchema,
  type CaseQuery,
  type CaseRecord,
  type EvidenceBundle,
  type Expert,
  type ExpertMatch,
  type ExpertSearchResult,
  type Guide,
  type GuideSearchResult,
  type MatchReason,
  type PriorityAssessment,
  type SimilarCaseSearchResult,
} from "@/shared/tools/first-response";

// スコア重み（LLMではなくコードで順位を確定する：REQUIREMENT §7.9/§11.1）
export const CATEGORY_WEIGHT = 5;
export const SPECIALTY_WEIGHT = 5;
export const TAG_WEIGHT = 2;
export const KEY_ISSUE_WEIGHT = 2;
export const PROPERTY_STATE_WEIGHT = 1;
export const RIGHTS_WEIGHT = 1;
export const STRENGTH_WEIGHT = 2;

// 最低基準（下回る候補は「十分な根拠なし」として表示しない）
export const SIMILAR_CASE_MIN_SCORE = 3;
export const GUIDE_MIN_SCORE = 3;
export const EXPERT_MIN_SCORE = 3;

// 表示件数上限（REQUIREMENT §7.9/§7.10/§7.11）
export const SIMILAR_CASE_LIMIT = 3;
export const GUIDE_LIMIT = 2;
export const EXPERT_LIMIT = 3;

// 安全確認を優先するキーワード（REQUIREMENT §7.6）
const SAFETY_KEYWORDS = [
  "倒壊",
  "崩落",
  "崩壊",
  "落下",
  "火災",
  "延焼",
  "焼損",
  "浸水",
  "漏電",
  "ガス漏れ",
  "土砂",
  "擁壁",
  "崖",
  "傾き",
  "傾いて",
  "著しい破損",
  "破損",
  "侵入",
  "不審者",
  "不法侵入",
] as const satisfies readonly string[];

// 早期の担当者確認が望ましいキーワード（REQUIREMENT §7.6）
const URGENCY_KEYWORDS = [
  "期限",
  "期日",
  "締切",
  "相続放棄",
  "連絡が取れない",
  "連絡がつかない",
  "連絡不通",
  "行方不明",
  "不在者",
  "係争",
  "訴訟",
  "調停",
  "滞納",
  "差押",
  "立ち退き",
  "退去",
] as const satisfies readonly string[];

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  const out = new Set<string>();
  for (const value of a) {
    if (setB.has(value)) {
      out.add(value);
    }
  }
  return [...out].sort();
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function totalScore(reasons: MatchReason[]): number {
  return reasons.reduce((sum, reason) => sum + reason.points, 0);
}

function matchKeywords(tokens: readonly string[], keywords: readonly string[]): string[] {
  const matched = new Set<string>();
  for (const keyword of keywords) {
    if (tokens.some((token) => token.includes(keyword))) {
      matched.add(keyword);
    }
  }
  return [...matched].sort();
}

// 抽出済み案件情報を検証・正規化する（ドメイン境界の入力検証）
export function parseCaseQuery(raw: unknown): CaseQuery {
  return CaseQuerySchema.parse(raw);
}

// 優先度は決定的なキーワード判定で確定する（検証は境界の parseCaseQuery で一度だけ行う）
export function assessPriority(query: CaseQuery): PriorityAssessment {
  const tokens = [...query.tags, ...query.keyIssues, ...query.propertyState, ...query.rights];

  const safety = matchKeywords(tokens, SAFETY_KEYWORDS);
  if (safety.length > 0) {
    return { level: "safety_first", reasons: safety };
  }

  const urgency = matchKeywords(tokens, URGENCY_KEYWORDS);
  if (urgency.length > 0) {
    return { level: "early_check", reasons: urgency };
  }

  const hasSubstance = query.category !== null || tokens.length > 0;
  if (!hasSubstance) {
    return { level: "needs_review", reasons: ["優先度を判断できる情報が不足しています"] };
  }

  return { level: "normal", reasons: ["安全上の懸念や緊急性を示す記載は見当たりません"] };
}

function scoreCase(query: CaseQuery, record: CaseRecord): MatchReason[] {
  const reasons: MatchReason[] = [];

  if (query.category !== null && query.category === record.category) {
    reasons.push({
      signal: "category",
      matched: [CASE_CATEGORY_LABELS[record.category]],
      points: CATEGORY_WEIGHT,
    });
  }

  const tags = intersect(query.tags, record.tags);
  if (tags.length > 0) {
    reasons.push({ signal: "tag", matched: tags, points: tags.length * TAG_WEIGHT });
  }

  const issues = intersect(query.keyIssues, record.keyIssues);
  if (issues.length > 0) {
    reasons.push({ signal: "keyIssue", matched: issues, points: issues.length * KEY_ISSUE_WEIGHT });
  }

  const propertyState = intersect(query.propertyState, record.propertyState);
  if (propertyState.length > 0) {
    reasons.push({
      signal: "propertyState",
      matched: propertyState,
      points: propertyState.length * PROPERTY_STATE_WEIGHT,
    });
  }

  const rights = intersect(query.rights, record.rights);
  if (rights.length > 0) {
    reasons.push({ signal: "rights", matched: rights, points: rights.length * RIGHTS_WEIGHT });
  }

  return reasons;
}

// 類似事例を決定的に順位付けする（同点は事例ID昇順）
export function searchSimilarCases(
  query: CaseQuery,
  cases: CaseRecord[] = CASES,
): SimilarCaseSearchResult {
  const matches = cases
    .flatMap((record) => {
      const reasons = scoreCase(query, record);
      const score = totalScore(reasons);
      return score >= SIMILAR_CASE_MIN_SCORE ? [{ case: record, score, reasons }] : [];
    })
    .sort((a, b) => b.score - a.score || compareId(a.case.id, b.case.id))
    .slice(0, SIMILAR_CASE_LIMIT);

  return { matches, hasSufficientEvidence: matches.length > 0 };
}

function scoreGuide(query: CaseQuery, guide: Guide): MatchReason[] {
  const reasons: MatchReason[] = [];

  if (query.category !== null && guide.targetCategories.includes(query.category)) {
    reasons.push({
      signal: "category",
      matched: [CASE_CATEGORY_LABELS[query.category]],
      points: CATEGORY_WEIGHT,
    });
  }

  const terms = unique([...query.tags, ...query.keyIssues]);
  const tags = intersect(terms, guide.tags);
  if (tags.length > 0) {
    reasons.push({ signal: "tag", matched: tags, points: tags.length * TAG_WEIGHT });
  }

  return reasons;
}

// 社内初動ガイドを決定的に順位付けする（同点はガイドID昇順）
export function searchGuides(query: CaseQuery, guides: Guide[] = GUIDES): GuideSearchResult {
  const matches = guides
    .flatMap((guide) => {
      const reasons = scoreGuide(query, guide);
      const score = totalScore(reasons);
      return score >= GUIDE_MIN_SCORE ? [{ guide, score, reasons }] : [];
    })
    .sort((a, b) => b.score - a.score || compareId(a.guide.id, b.guide.id))
    .slice(0, GUIDE_LIMIT);

  return { matches, hasSufficientEvidence: matches.length > 0 };
}

function scoreExpert(query: CaseQuery, expert: Expert): MatchReason[] {
  const reasons: MatchReason[] = [];

  if (query.category !== null && expert.specialties.includes(query.category)) {
    reasons.push({
      signal: "specialty",
      matched: [CASE_CATEGORY_LABELS[query.category]],
      points: SPECIALTY_WEIGHT,
    });
  }

  const terms = unique([...query.keyIssues, ...query.tags]);
  const strengths = intersect(terms, expert.strengths);
  if (strengths.length > 0) {
    reasons.push({ signal: "strength", matched: strengths, points: strengths.length * STRENGTH_WEIGHT });
  }

  return reasons;
}

function buildRecommendation(expert: Expert, reasons: MatchReason[]): string {
  const categories = expert.specialties.map((category) => CASE_CATEGORY_LABELS[category]).join("・");
  let recommendation = `${categories}領域を得意とし、関連案件${expert.relatedCaseCount}件の対応実績があります。`;

  const strength = reasons.find((reason) => reason.signal === "strength");
  if (strength && strength.matched.length > 0) {
    recommendation += `特に${strength.matched.join("、")}に関する相談に対応できます。`;
  }

  return recommendation;
}

// 有識者候補を決定的に順位付けする（スコア→関連案件数→社員ID昇順）
export function searchExperts(query: CaseQuery, experts: Expert[] = EXPERTS): ExpertSearchResult {
  const matches: ExpertMatch[] = experts
    .flatMap((expert) => {
      const reasons = scoreExpert(query, expert);
      const score = totalScore(reasons);
      if (score < EXPERT_MIN_SCORE) {
        return [];
      }
      return [
        {
          expert,
          score,
          reasons,
          recommendation: buildRecommendation(expert, reasons),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.expert.relatedCaseCount - a.expert.relatedCaseCount ||
        compareId(a.expert.id, b.expert.id),
    )
    .slice(0, EXPERT_LIMIT);

  return { matches, hasSufficientEvidence: matches.length > 0 };
}

// 決定的な根拠部分（優先度・類似事例・ガイド・有識者）をまとめて返す
export function buildEvidenceBundle(query: CaseQuery): EvidenceBundle {
  return {
    priority: assessPriority(query),
    similarCases: searchSimilarCases(query),
    guides: searchGuides(query),
    experts: searchExperts(query),
  };
}
