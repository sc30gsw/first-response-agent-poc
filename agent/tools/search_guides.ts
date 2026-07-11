import { defineTool } from "eve/tools";
import { parseCaseQuery, searchGuides } from "#lib/domain/search";
import { GuideSearchResultSchema } from "@/shared/tools/first-response";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "Deterministically search fictional internal initial-response guides. Return at most two candidates and break ties by ascending guide ID. Do not alter this tool's ranking or scores. When hasSufficientEvidence is false, state 「十分な根拠なし」 in Japanese.",
  inputSchema: CaseQueryInputSchema,
  outputSchema: GuideSearchResultSchema,
  execute(input) {
    return searchGuides(parseCaseQuery(input));
  },
});
