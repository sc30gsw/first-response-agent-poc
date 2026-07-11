import type { DynamicToolUIPart } from "ai";
import type {
  AnalyzeCaseOutput,
  DraftConsultationOutput,
  ExpertSearchResult,
  GuideSearchResult,
  SimilarCaseSearchResult,
} from "@/shared/tools/first-response";

export type AnalyzeCaseUIToolInvocation = DynamicToolUIPart & {
  output: AnalyzeCaseOutput;
};

export type DraftConsultationUIToolInvocation = DynamicToolUIPart & {
  output: DraftConsultationOutput;
};

export type SimilarCasesUIToolInvocation = DynamicToolUIPart & {
  output: SimilarCaseSearchResult;
};

export type GuidesUIToolInvocation = DynamicToolUIPart & {
  output: GuideSearchResult;
};

export type ExpertsUIToolInvocation = DynamicToolUIPart & {
  output: ExpertSearchResult;
};

export const EVIDENCE_SEARCH_TOOL_NAMES = [
  "search_similar_cases",
  "search_guides",
  "search_experts",
] as const satisfies readonly string[];

export type EvidenceSearchToolName = (typeof EVIDENCE_SEARCH_TOOL_NAMES)[number];

export function isEvidenceSearchToolName(name: string): name is EvidenceSearchToolName {
  return (EVIDENCE_SEARCH_TOOL_NAMES as readonly string[]).includes(name);
}
