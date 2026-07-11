import { defineTool } from "eve/tools";
import { SimilarCaseSearchResultSchema, parseCaseQuery, searchSimilarCases } from "#lib/domain";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "架空の過去事例から類似事例を決定的に検索する（上位3件・同点は事例ID昇順）。順位とスコアはこのツールが確定するため変更してはならない。hasSufficientEvidence が false の場合は「十分な根拠なし」と伝える。",
  inputSchema: CaseQueryInputSchema,
  outputSchema: SimilarCaseSearchResultSchema,
  execute(input) {
    return searchSimilarCases(parseCaseQuery(input));
  },
});
