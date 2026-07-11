import { defineTool } from "eve/tools";
import { GuideSearchResultSchema, parseCaseQuery, searchGuides } from "#lib/domain";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "架空の社内初動ガイドを決定的に検索する（上位2件・同点はガイドID昇順）。順位とスコアはこのツールが確定するため変更してはならない。hasSufficientEvidence が false の場合は「十分な根拠なし」と伝える。",
  inputSchema: CaseQueryInputSchema,
  outputSchema: GuideSearchResultSchema,
  execute(input) {
    return searchGuides(parseCaseQuery(input));
  },
});
