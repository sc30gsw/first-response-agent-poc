import { defineTool } from "eve/tools";
import { ExpertSearchResultSchema, parseCaseQuery, searchExperts } from "#lib/domain";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "Deterministically search fictional internal experts for consultation candidates. Return at most three candidates; rank by score, related-case count, then ascending employee ID. Do not alter the ranking, scores, or recommendations. Never propose a person absent from this tool's result.",
  inputSchema: CaseQueryInputSchema,
  outputSchema: ExpertSearchResultSchema,
  execute(input) {
    return searchExperts(parseCaseQuery(input));
  },
});
