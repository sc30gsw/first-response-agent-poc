import { defineTool } from "eve/tools";
import { parseCaseQuery, searchSimilarCases } from "#lib/domain/search";
import { SimilarCaseSearchResultSchema } from "@/shared/tools/first-response";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "Deterministically search fictional past cases for similar cases. Return at most three candidates and break ties by ascending case ID. Do not alter this tool's ranking or scores. When hasSufficientEvidence is false, state 「十分な根拠なし」 in Japanese.",
  inputSchema: CaseQueryInputSchema,
  outputSchema: SimilarCaseSearchResultSchema,
  execute(input) {
    return searchSimilarCases(parseCaseQuery(input));
  },
});
