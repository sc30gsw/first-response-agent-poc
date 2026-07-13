"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { AnalyzeCaseOutput, Expert } from "@/shared/tools/first-response";

type ReportContextValue = {
  readonly output: AnalyzeCaseOutput;
  readonly canRespond: boolean;
  readonly onFocusComposer: () => void;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
};

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children, ...value }: ReportContextValue & { readonly children: ReactNode }) {
  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReportContext() {
  const context = useContext(ReportContext);
  if (!context) throw new Error("Analysis GenUI components must be rendered inside ReportProvider.");
  return context;
}
