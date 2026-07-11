import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  CASE_CATEGORY_LABELS,
  InitialReportSchema,
  PRIORITY_LABELS,
  buildEvidenceBundle,
  parseCaseQuery,
} from "#lib/domain";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

export default defineTool({
  description:
    "Create an initial-response report from structured case information. This tool deterministically returns priority, similar cases, internal guides, and expert candidates. Do not alter its ranking, scores, or evidence. Use it for both a new inquiry's initial analysis and a reanalysis after additional information.",
  inputSchema: z.object({
    analysisType: z
      .enum(["initial", "reanalysis"])
      .describe("Use initial for a first analysis and reanalysis after incorporating additional information."),
    ...CaseQueryInputSchema.shape,
    stakeholders: z
      .array(z.string())
      .default([])
      .describe("Relevant people, such as three heirs or a tenant. Do not include personally identifiable information."),
    customerWish: z.string().min(1).describe("The customer's goal. Write in Japanese and use 「不明」 when it is not stated."),
    currentProblem: z.string().min(1).describe("The current problem. Write in Japanese and use 「不明」 when it is not stated."),
    unknowns: z.array(z.string()).default([]).describe("Important facts missing from the input. Write each item in Japanese."),
    missingInfo: z
      .array(z.string())
      .max(5)
      .default([])
      .describe("Important facts that cannot be determined from the input, up to five items. Write each item in Japanese."),
    actionItems: z
      .array(z.string())
      .max(7)
      .default([])
      .describe(
        "Prioritized initial checks, up to seven items. Limit them to fact-finding and identifying consultation paths; do not state legal conclusions or procedural decisions. Write each item in Japanese.",
      ),
    humanEscalation: z
      .array(z.string())
      .default([])
      .describe("Items requiring a human or specialist to confirm. Include legal, tax, appraisal, and contract-related issues. Write each item in Japanese."),
    followUpQuestion: z.string().min(1).describe("One next question for the user. Write it in Japanese."),
  }),
  outputSchema: z.object({
    analysisType: z.enum(["initial", "reanalysis"]),
    analysisLabel: z.string(),
    categoryLabel: z.string().nullable(),
    priorityLabel: z.string(),
    report: InitialReportSchema,
  }),
  execute(input) {
    const query = parseCaseQuery({
      category: input.category,
      tags: input.tags,
      keyIssues: input.keyIssues,
      propertyState: input.propertyState,
      rights: input.rights,
    });
    const evidence = buildEvidenceBundle(query);

    const report = InitialReportSchema.parse({
      caseSummary: {
        category: query.category,
        propertyState: query.propertyState,
        rights: query.rights,
        stakeholders: input.stakeholders,
        customerWish: input.customerWish,
        currentProblem: input.currentProblem,
        unknowns: input.unknowns,
      },
      priority: evidence.priority,
      missingInfo: input.missingInfo,
      actionItems: input.actionItems,
      similarCases: evidence.similarCases,
      guides: evidence.guides,
      experts: evidence.experts,
      humanEscalation: input.humanEscalation,
      followUpQuestion: input.followUpQuestion,
    });

    return {
      analysisType: input.analysisType,
      analysisLabel: input.analysisType === "initial" ? "初回分析" : "再分析",
      categoryLabel: query.category === null ? null : CASE_CATEGORY_LABELS[query.category],
      priorityLabel: PRIORITY_LABELS[report.priority.level],
      report,
    };
  },
});
