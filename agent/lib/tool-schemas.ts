import { z } from "zod";
import { CaseQuerySchema } from "@/shared/tools/first-response";

// Shared input schema for search tools. It matches the domain-layer CaseQuery and includes model-facing descriptions.
export const CaseQueryInputSchema = z.object({
  category: CaseQuerySchema.shape.category.describe(
      "Case category: inheritance for inheritance or co-ownership, stigmatized for incidents or disclosure matters, and non_rebuildable for non-rebuildable or aging properties. Use null when it cannot be determined.",
    ),
  tags: CaseQuerySchema.shape.tags.describe(
      "Tags that apply to the inquiry. Match the initial-triage vocabulary exactly. You may add the inquiry's original wording for safety or urgency signals.",
    ),
  keyIssues: CaseQuerySchema.shape.keyIssues
    .describe("Key issues. Select values from the initial-triage vocabulary."),
  propertyState: CaseQuerySchema.shape.propertyState
    .describe("Property state. Select values from the initial-triage vocabulary."),
  rights: CaseQuerySchema.shape.rights
    .describe("Rights and ownership status. Select values from the initial-triage vocabulary."),
});

export type CaseQueryInput = z.output<typeof CaseQueryInputSchema>;
