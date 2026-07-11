import { defineTool } from "eve/tools";
import { z } from "zod";
import { buildConsultationDraft } from "#lib/consultation-draft";
import {
  DraftConsultationOutputSchema,
  PriorityLevelSchema,
} from "@/shared/tools/first-response";

export default defineTool({
  description:
    "Create a Japanese internal consultation-request draft for the selected expert. Return a copyable draft only; never send email or chat messages. expertId must be an employee ID returned by analyze_case or search_experts.",
  inputSchema: z.object({
    expertId: z
      .string()
      .min(1)
      .describe("The employee ID of an expert returned by analyze_case or search_experts."),
    caseOverview: z
      .string()
      .min(1)
      .describe("A Japanese summary of the case. Do not include actual names, addresses, or contact details."),
    consultationPoints: z
      .array(z.string().min(1))
      .min(1)
      .describe("Points to be confirmed. Write each item in Japanese."),
    priorityLevel: PriorityLevelSchema.describe("The priority level returned by analyze_case."),
    referencedCaseIds: z
      .array(z.string())
      .default([])
      .describe("Referenced case IDs. Use only IDs returned by the tools."),
    referencedGuideIds: z
      .array(z.string())
      .default([])
      .describe("Referenced guide IDs. Use only IDs returned by the tools."),
  }),
  outputSchema: DraftConsultationOutputSchema,
  execute(input) {
    return buildConsultationDraft(input);
  },
});
