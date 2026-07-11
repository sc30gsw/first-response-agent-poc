import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  type AnalyzeCaseOutput,
  AnalyzeCaseOutputSchema,
  CASE_CATEGORY_LABELS,
  InitialReportSchema,
  PRIORITY_LABELS,
} from "@/shared/tools/first-response";
import { buildEvidenceBundle, parseCaseQuery } from "#lib/domain/search";
import { CaseQueryInputSchema } from "#lib/tool-schemas";

const analysisInputBaseShape = {
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
};

export default defineTool({
  description:
    "Create an initial-response report from structured case information. This tool deterministically returns priority, similar cases, internal guides, and expert candidates. Do not alter its ranking, scores, or evidence. Use it for both a new inquiry's initial analysis and a reanalysis after additional information.",
  inputSchema: z.discriminatedUnion("analysisType", [
    z.object({
      analysisType: z.literal("initial"),
      ...analysisInputBaseShape,
    }),
    z.object({
      analysisType: z.literal("reanalysis"),
      ...analysisInputBaseShape,
      resolvedUnknowns: z
        .array(z.string().min(1))
        .max(5)
        .default([])
        .describe("Previously unknown items resolved by the user's additional information. Write each item in Japanese."),
      newFacts: z
        .array(z.string().min(1))
        .max(7)
        .default([])
        .describe("New facts learned from the user's additional information. Write each item in Japanese."),
    }),
  ]),
  outputSchema: AnalyzeCaseOutputSchema,
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
      reanalysisChanges: input.analysisType === "reanalysis"
        ? {
            resolvedUnknowns: input.resolvedUnknowns,
            newFacts: input.newFacts,
          }
        : null,
    });

    const outputBase = {
      categoryLabel: query.category === null ? null : CASE_CATEGORY_LABELS[query.category],
      priorityLabel: PRIORITY_LABELS[report.priority.level],
    } as const;

    if (input.analysisType === "initial") {
      return {
        ...outputBase,
        analysisType: "initial",
        analysisLabel: "初回分析",
        report: { ...report, reanalysisChanges: null },
      } as const satisfies AnalyzeCaseOutput;
    }

    return {
      ...outputBase,
      analysisType: "reanalysis",
      analysisLabel: "再分析",
      report: {
        ...report,
        reanalysisChanges: {
          resolvedUnknowns: input.resolvedUnknowns,
          newFacts: input.newFacts,
        },
      },
    } as const satisfies AnalyzeCaseOutput;
  },
});
