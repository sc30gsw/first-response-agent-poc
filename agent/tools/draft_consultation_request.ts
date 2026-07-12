import { defineTool } from "eve/tools";
import {
  buildConsultationDraft,
  ConsultationDraftInputSchema,
} from "#lib/consultation-draft";
import {
  DraftConsultationOutputSchema,
} from "@/shared/tools/first-response";

export default defineTool({
  description:
    "Create a Japanese internal consultation-request draft for the selected expert. Return a copyable draft only; never send email or chat messages. expertId must be an employee ID returned by analyze_case or search_experts.",
  inputSchema: ConsultationDraftInputSchema,
  outputSchema: DraftConsultationOutputSchema,
  execute(input) {
    return buildConsultationDraft(input);
  },
});
