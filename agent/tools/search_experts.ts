import { defineTool } from "eve/tools";
import { ExpertSearchResultSchema, parseCaseQuery, searchExperts } from "#lib/domain";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "架空の社内有識者から相談先候補を決定的に検索する（上位3名・スコア→関連案件数→社員ID昇順）。順位・スコア・推薦理由はこのツールが確定するため変更してはならない。ここに無い人物を候補として挙げてはならない。",
  inputSchema: CaseQueryInputSchema,
  outputSchema: ExpertSearchResultSchema,
  execute(input) {
    return searchExperts(parseCaseQuery(input));
  },
});
