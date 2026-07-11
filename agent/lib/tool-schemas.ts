import { z } from "zod";
import { CaseCategorySchema } from "#lib/domain";

// Shared input schema for search tools. It matches the domain-layer CaseQuery and includes model-facing descriptions.
export const CaseQueryInputSchema = z.object({
  category: CaseCategorySchema.nullable()
    .default(null)
    .describe(
      "Case category: inheritance for inheritance or co-ownership, stigmatized for incidents or disclosure matters, and non_rebuildable for non-rebuildable or aging properties. Use null when it cannot be determined.",
    ),
  tags: z
    .array(z.string())
    .default([])
    .describe(
      "Tags that apply to the inquiry. Match the initial-triage vocabulary exactly. You may add the inquiry's original wording for safety or urgency signals.",
    ),
  keyIssues: z
    .array(z.string())
    .default([])
    .describe("Key issues. Select values from the initial-triage vocabulary."),
  propertyState: z
    .array(z.string())
    .default([])
    .describe("Property state. Select values from the initial-triage vocabulary."),
  rights: z
    .array(z.string())
    .default([])
    .describe("Rights and ownership status. Select values from the initial-triage vocabulary."),
});

export type CaseQueryInput = z.infer<typeof CaseQueryInputSchema>;
