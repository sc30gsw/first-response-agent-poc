"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { cn } from "cnfast";
import type { ReactNode } from "react";
import { z } from "zod/v4";
import type { AnalyzeCaseOutput, Expert } from "@/shared/tools/first-response";
import { useReportContext } from "./report-context";

const childrenSchema = z.array(z.any());

function emptyProps(name: string) {
  return z.object({}).describe(`${name} has no arguments`);
}

function renderItems(items: readonly string[], empty: string) {
  if (items.length === 0) return <p className="m-0 rounded-[9px] border border-dashed border-[#b9c9c6] px-3.5 py-3 text-[0.8rem] text-ink-soft">{empty}</p>;
  return <ol className="m-0 grid list-none gap-2.5 p-0" role="list">{[...new Set(items)].map((item, index) => <li className="flex gap-3 rounded-[9px] border border-line bg-[#fbfdfc] px-3 py-2.5" key={item}><span className="text-[0.7rem] font-black text-[#176c67]">{String(index + 1).padStart(2, "0")}</span><p className="m-0 text-[0.85rem] leading-[1.7]">{item}</p></li>)}</ol>;
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <section className="grid gap-3.5"><h3 className="m-0 border-b border-line pb-2 text-[0.95rem] tracking-[0.03em]">{title}</h3>{children}</section>;
}

type ReportBlockKind = "CaseSummary" | "PriorityBanner" | "MissingInfo" | "ActionItems" | "SimilarCases" | "Guides" | "Experts" | "Escalation" | "ReanalysisChanges";

function ReportBlock({ kind }: { readonly kind: ReportBlockKind }) {
  const context = useReportContext();

  switch (kind) {
    case "CaseSummary": return <CaseSummaryBlock output={context.output} />;
    case "PriorityBanner": return <PriorityBannerBlock output={context.output} />;
    case "MissingInfo": return <Section title="不足情報">{renderItems(context.output.report.missingInfo, "不足情報はありません")}</Section>;
    case "ActionItems": return <Section title="初動確認事項">{renderItems(context.output.report.actionItems, "確認事項はありません")}</Section>;
    case "SimilarCases": return <SimilarCasesBlock output={context.output} />;
    case "Guides": return <GuidesBlock output={context.output} />;
    case "Experts": return <ExpertsBlock canRespond={context.canRespond} onRequestConsultation={context.onRequestConsultation} output={context.output} />;
    case "Escalation": return <EscalationBlock canRespond={context.canRespond} onFocusComposer={context.onFocusComposer} output={context.output} />;
    case "ReanalysisChanges": return <ReanalysisChangesBlock output={context.output} />;
  }
}

function CaseSummaryBlock({ output }: { readonly output: AnalyzeCaseOutput }) {
  const summary = output.report.caseSummary;
  const items = [["案件種別", output.categoryLabel ?? "要確認"], ["物件状態", summary.propertyState.join("・") || "要確認"], ["権利関係", summary.rights.join("・") || "要確認"], ["関係者", summary.stakeholders.join("・") || "要確認"], ["顧客の希望", summary.customerWish], ["現在の問題", summary.currentProblem]] as const;
  return <Section title="案件要約"><dl className="grid grid-cols-2 gap-px border border-line bg-line max-md:grid-cols-1">{items.map(([term, value], index) => <div className={cn("grid gap-[5px] bg-[#fbfdfc] px-3.5 py-3", index > 3 && "col-span-full max-md:col-auto")} key={term}><dt className="text-[0.68rem] font-extrabold tracking-[0.06em] text-ink-soft">{term}</dt><dd className="m-0 text-[0.88rem] font-semibold leading-[1.7]">{value}</dd></div>)}</dl>{summary.unknowns.length > 0 ? <div className="flex flex-wrap items-center gap-2.5 rounded-[9px] border border-[#e4d3ad] bg-amber-pale px-3.5 py-[11px] text-[0.76rem] text-[#654c1d]"><strong>不明点</strong>{summary.unknowns.map(item => <span className="rounded-full border border-[#b6cac7] bg-white px-[9px] py-[3px] text-[0.68rem] font-bold text-[#3c5652]" key={item}>{item}</span>)}</div> : null}</Section>;
}

function PriorityBannerBlock({ output }: { readonly output: AnalyzeCaseOutput }) {
  const { priority } = output.report;
  return <Section title="優先度と理由"><div className={cn("grid gap-3 rounded-r-[10px] border-l-4 border-l-teal bg-[#f7faf9] px-[18px] py-4", priority.level === "safety_first" && "border-l-danger bg-[#fdf3f3]", (priority.level === "early_check" || priority.level === "needs_review") && "border-l-amber bg-amber-pale")}><strong className="inline-flex w-fit rounded-full border border-current px-3 py-1 text-[0.74rem]">{output.priorityLabel}</strong><ul className="m-0 grid gap-1.5 pl-5 text-[0.86rem] leading-[1.7]">{[...new Set(priority.reasons)].map(reason => <li key={reason}>{reason}</li>)}</ul><p className="m-0 text-[0.72rem] text-ink-soft">法的な緊急性の判定ではなく、入力内容を整理する目安です。</p></div></Section>;
}

function SimilarCasesBlock({ output }: { readonly output: AnalyzeCaseOutput }) {
  const result = output.report.similarCases;
  return <Section title="類似事例">{result.matches.length === 0 ? <NoEvidence /> : <ol className="m-0 grid list-none gap-3 p-0" role="list">{result.matches.map((match, index) => <li className="rounded-[10px] border border-line bg-[#fbfdfc] p-3" key={match.case.id}><strong>{String(index + 1).padStart(2, "0")}　{match.case.id}</strong><p className="my-1 text-[0.82rem]">{match.case.summary}</p><p className="m-0 text-[0.76rem] text-ink-soft">{match.score} 点</p></li>)}</ol>}</Section>;
}

function GuidesBlock({ output }: { readonly output: AnalyzeCaseOutput }) {
  const result = output.report.guides;
  return <Section title="社内初動ガイド">{result.matches.length === 0 ? <NoEvidence /> : <ol className="m-0 grid list-none gap-3 p-0" role="list">{result.matches.map((match, index) => <li className="rounded-[10px] border border-line bg-[#fbfdfc] p-3" key={match.guide.id}><strong>{String(index + 1).padStart(2, "0")}　{match.guide.id}　{match.guide.title}</strong><p className="m-0 mt-1 text-[0.76rem] text-ink-soft">{match.score} 点</p></li>)}</ol>}</Section>;
}

function ExpertsBlock({ canRespond, onRequestConsultation, output }: { readonly canRespond: boolean; readonly onRequestConsultation: (expert: Expert) => Promise<void>; readonly output: AnalyzeCaseOutput }) {
  const result = output.report.experts;
  return <Section title="有識者候補">{result.matches.length === 0 ? <NoEvidence /> : <div className="grid gap-3.5 md:grid-cols-2">{result.matches.map((match, index) => <article className="grid gap-2 rounded-[10px] border border-line bg-[#fbfdfc] p-3" key={match.expert.id}><strong>{String(index + 1).padStart(2, "0")}　{match.expert.name}</strong><p className="m-0 text-[0.76rem] text-ink-soft">{match.expert.department}・{match.score} 点</p><p className="m-0 text-[0.78rem]">{match.recommendation}</p><button className="min-h-10 rounded-lg border border-control-line bg-white px-3.5 py-2 text-[0.78rem] font-extrabold text-navy hover:border-teal hover:bg-teal-pale disabled:cursor-not-allowed disabled:opacity-[.55]" type="button" disabled={!canRespond} onClick={() => void onRequestConsultation(match.expert)}>この人への相談文を作成</button></article>)}</div>}</Section>;
}

function EscalationBlock({ canRespond, onFocusComposer, output }: { readonly canRespond: boolean; readonly onFocusComposer: () => void; readonly output: AnalyzeCaseOutput }) {
  return <><Section title="人間・専門家の確認が必要"><div className="rounded-r-[10px] border border-[#e4d3ad] border-l-4 border-l-amber bg-amber-pale px-[18px] py-4"><ul className="m-0 grid gap-1.5 pl-5 text-[0.85rem] leading-[1.7] text-[#4d3a12]">{output.report.humanEscalation.map(item => <li key={item}>{item}</li>)}</ul><p className="mb-0 text-[0.74rem] font-bold text-[#6d5011]">最終判断と実際の連絡は、担当者または適切な専門家が行ってください。</p></div></Section><section className="flex flex-wrap items-center gap-4 rounded-xl bg-navy-deep px-5 py-[18px] text-white"><div className="min-w-[220px] flex-1"><p className="mb-1 text-[0.68rem] font-extrabold tracking-[0.08em] text-[#a9cbc7]">次に確認したいこと</p><h3 className="m-0 text-base leading-[1.6]">{output.report.followUpQuestion}</h3></div><button className="min-h-10 rounded-lg border border-control-line bg-white px-3.5 py-2 text-[0.78rem] font-extrabold text-navy hover:border-teal hover:bg-teal-pale disabled:cursor-not-allowed disabled:opacity-[.55]" type="button" disabled={!canRespond} onClick={onFocusComposer}>追加情報を入力して再分析</button></section></>;
}

function ReanalysisChangesBlock({ output }: { readonly output: AnalyzeCaseOutput }) {
  const changes = output.report.reanalysisChanges;
  if (!changes) return null;
  return <Section title="前回分析からの更新"><div className="grid gap-5 md:grid-cols-2"><div><h4 className="mt-0 mb-2.5 text-[0.82rem] text-navy">解消した不明点</h4>{renderItems(changes.resolvedUnknowns, "今回解消した不明点はありません")}</div><div><h4 className="mt-0 mb-2.5 text-[0.82rem] text-navy">新たに判明した事実</h4>{renderItems(changes.newFacts, "新たに判明した事実はありません")}</div></div></Section>;
}

function NoEvidence() {
  return <p className="m-0 rounded-[10px] border border-dashed border-[#c4a75c] bg-amber-pale p-3.5 text-[0.78rem] text-[#654c1d]">十分な根拠なし</p>;
}

const Report = defineComponent({ name: "Report", description: "Root container. Pass the ordered report blocks as its only argument.", props: z.object({ children: childrenSchema }), component: ({ props, renderNode }) => <article className="grid gap-[26px] rounded-[4px_18px_4px_4px] border border-[#c9d7d4] bg-paper p-[clamp(18px,3vw,30px)] shadow-[0_16px_44px_rgb(16_38_59_/_8%)]">{renderNode(props.children)}</article> });
const CaseSummary = defineComponent({ name: "CaseSummary", description: "Canonical case summary from the analysis tool. Takes no arguments.", props: emptyProps("CaseSummary"), component: () => <ReportBlock kind="CaseSummary" /> });
const PriorityBanner = defineComponent({ name: "PriorityBanner", description: "Canonical priority and reasons from the analysis tool. Takes no arguments.", props: emptyProps("PriorityBanner"), component: () => <ReportBlock kind="PriorityBanner" /> });
const MissingInfo = defineComponent({ name: "MissingInfo", description: "Missing information from the analysis tool. Takes no arguments.", props: emptyProps("MissingInfo"), component: () => <ReportBlock kind="MissingInfo" /> });
const ActionItems = defineComponent({ name: "ActionItems", description: "Initial actions from the analysis tool. Takes no arguments.", props: emptyProps("ActionItems"), component: () => <ReportBlock kind="ActionItems" /> });
const SimilarCases = defineComponent({ name: "SimilarCases", description: "Ranked similar cases from the analysis tool. Takes no arguments.", props: emptyProps("SimilarCases"), component: () => <ReportBlock kind="SimilarCases" /> });
const Guides = defineComponent({ name: "Guides", description: "Ranked internal guides from the analysis tool. Takes no arguments.", props: emptyProps("Guides"), component: () => <ReportBlock kind="Guides" /> });
const Experts = defineComponent({ name: "Experts", description: "Ranked internal experts from the analysis tool. Takes no arguments.", props: emptyProps("Experts"), component: () => <ReportBlock kind="Experts" /> });
const Escalation = defineComponent({ name: "Escalation", description: "Human escalation and the canonical follow-up question. Takes no arguments.", props: emptyProps("Escalation"), component: () => <ReportBlock kind="Escalation" /> });
const ReanalysisChanges = defineComponent({ name: "ReanalysisChanges", description: "Changes since the previous analysis. Use only for a reanalysis. Takes no arguments.", props: emptyProps("ReanalysisChanges"), component: () => <ReportBlock kind="ReanalysisChanges" /> });
const Note = defineComponent({ name: "Note", description: "A short Japanese connective sentence. Never use case facts, scores, identifiers, URLs, legal or tax conclusions, or instructions.", props: z.object({ text: z.string().min(1).max(120) }), component: ({ props }) => <p className="m-0 rounded-[9px] border border-[#a8cbc7] bg-teal-pale px-3.5 py-3 text-[0.8rem] leading-[1.7] text-[#105e59]">{props.text}</p> });

export const library = createLibrary({ root: "Report", components: [Report, CaseSummary, PriorityBanner, MissingInfo, ActionItems, SimilarCases, Guides, Experts, Escalation, ReanalysisChanges, Note] });

export const promptOptions = {
  additionalRules: [
    "For a successful analyze_case result, output exactly one fenced `openui` block and no text outside it.",
    "The first complete statement must be root = Report([...]). Put every required component reference in root in the chosen order.",
    "Use CaseSummary, PriorityBanner, MissingInfo, ActionItems, SimilarCases, Guides, Experts, and Escalation exactly once. Use ReanalysisChanges exactly once only for a reanalysis.",
    "All domain components take no arguments and obtain canonical data from the tool output. Never put case facts, IDs, scores, rankings, evidence, or the follow-up question into the program.",
    "For safety_first analyses, put PriorityBanner and Escalation first. Note is optional, at most once, in Japanese, and must be a short generic connective sentence.",
  ],
};
