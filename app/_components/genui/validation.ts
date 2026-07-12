import { createParser } from "@openuidev/react-lang";
import type { AnalyzeCaseOutput } from "@/shared/tools/first-response";
import { library } from "./library";

const REQUIRED = ["CaseSummary", "PriorityBanner", "MissingInfo", "ActionItems", "SimilarCases", "Guides", "Experts", "Escalation"] as const;
const FORBIDDEN_NOTE = /(?:https?:\/\/|\b(?:CASE|GUIDE|EXP|STAFF)-|\d|法律|税務|契約可否|査定)/u;

export type GenUiValidation = { readonly ok: true } | { readonly ok: false; readonly code: string };

export function validateAnalysisGenUi(source: string, output: AnalyzeCaseOutput): GenUiValidation {
  const parsed = createParser(library.toJSONSchema(), "Report").parse(source);
  if ((parsed.meta?.errors ?? []).length > 0) return { ok: false, code: "parse_error" };
  if (!/^\s*root\s*=\s*Report\(/u.test(source)) return { ok: false, code: "invalid_root" };

  for (const component of REQUIRED) {
    if (countCalls(source, component) !== 1) return { ok: false, code: `invalid_${component}` };
  }
  const reanalysisCount = countCalls(source, "ReanalysisChanges");
  if ((output.analysisType === "reanalysis" && reanalysisCount !== 1) || (output.analysisType === "initial" && reanalysisCount !== 0)) return { ok: false, code: "invalid_reanalysis_changes" };
  const notes = [...source.matchAll(/\bNote\(\s*"([^"]*)"\s*\)/gu)].map(match => match[1]);
  if (notes.length > 1 || notes.some(note => note.length > 120 || FORBIDDEN_NOTE.test(note))) return { ok: false, code: "invalid_note" };
  if (output.report.priority.level === "safety_first") {
    const root = /root\s*=\s*Report\(\s*\[([^\]]*)\]/u.exec(source)?.[1] ?? "";
    const order = root.split(",").map(item => item.trim());
    const priority = declarationName(source, "PriorityBanner");
    const escalation = declarationName(source, "Escalation");
    if (!priority || !escalation || order.indexOf(priority) > 1 || order.indexOf(escalation) > 2) return { ok: false, code: "unsafe_priority_order" };
  }
  return { ok: true };
}

function countCalls(source: string, name: string) {
  return (source.match(new RegExp(`\\b${name}\\s*\\(`, "gu")) ?? []).length;
}

function declarationName(source: string, component: string) {
  return new RegExp(`\\b([A-Za-z][A-Za-z0-9_]*)\\s*=\\s*${component}\\s*\\(`, "u").exec(source)?.[1] ?? null;
}
