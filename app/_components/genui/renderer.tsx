"use client";

import { Renderer } from "@openuidev/react-lang";
import type { AnalyzeCaseOutput, Expert } from "@/shared/tools/first-response";
import { library } from "./library";
import { ReportProvider } from "./report-context";

export function AnalysisGenUi({
  canRespond,
  isStreaming,
  onFocusComposer,
  onRequestConsultation,
  output,
  response,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly onFocusComposer: () => void;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly output: AnalyzeCaseOutput;
  readonly response: string;
}) {
  return <ReportProvider output={output} canRespond={canRespond} onFocusComposer={onFocusComposer} onRequestConsultation={onRequestConsultation}><Renderer response={response} library={library} isStreaming={isStreaming} onError={(errors) => { if (!isStreaming && errors.length > 0) console.warn("OpenUI analysis render error", errors.map(error => error.code)); }} /></ReportProvider>;
}

export function AnalysisGenUiSkeleton() {
  return <div className="grid gap-3 rounded-[4px_18px_4px_4px] border border-[#c9d7d4] bg-paper p-5"><p className="m-0 flex items-center gap-3 text-[0.86rem] font-bold text-[#176c67]"><span className="relative size-4 shrink-0" aria-hidden="true"><span className="absolute inset-0 rounded-full border-2 border-[#a8cbc7]" /><span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-teal motion-reduce:animate-none" /></span>レポートを構成しています…</p><div className="h-20 animate-pulse rounded-lg bg-[#edf4f2] motion-reduce:animate-none" /><div className="h-28 animate-pulse rounded-lg bg-[#edf4f2] motion-reduce:animate-none" /></div>;
}
