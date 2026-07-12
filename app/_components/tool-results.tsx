"use client";

import { Result } from "better-result";
import type { EveDynamicToolPart } from "eve/react";
import { useId, useState } from "react";
import { cn } from "cnfast";
import type { EveInputResponder } from "@/shared/eve-events";
import type {
  AnalyzeCaseOutput,
  DraftConsultationOutput,
  Expert,
  ExpertSearchResult,
  GuideSearchResult,
  MatchReason,
  PriorityLevel,
  SimilarCaseSearchResult,
} from "@/shared/tools/first-response";
import {
  AnalyzeCaseOutputSchema,
  CASE_CATEGORY_LABELS,
  DraftConsultationOutputSchema,
  ExpertSearchResultSchema,
  GuideSearchResultSchema,
  SimilarCaseSearchResultSchema,
} from "@/shared/tools/first-response";

const TOOL_LABELS = {
  analyze_case: "初動レポート",
  draft_consultation_request: "相談依頼文",
  search_experts: "有識者候補",
  search_guides: "社内初動ガイド",
  search_similar_cases: "類似事例",
} as const satisfies Record<string, string>;

const TOOL_PROGRESS = "mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-[9px] border border-[#d5e0de] bg-[#f7faf9] px-3.5 py-3 text-[0.74rem]";
const TOOL_ERROR = "mt-3 rounded-[9px] border border-[#e1bebe] bg-[#fdf3f3] px-3.5 py-3 text-[0.82rem] font-bold text-danger";
const CARD = "grid gap-[26px] mt-3.5 rounded-[4px_18px_4px_4px] border border-[#c9d7d4] bg-paper p-[clamp(18px,3vw,30px)] shadow-[0_16px_44px_rgb(16_38_59_/_8%)]";
const SECONDARY_BUTTON = "inline-flex min-h-10 items-center justify-between gap-2.5 rounded-lg border border-control-line bg-white px-3.5 py-2 text-[0.78rem] font-extrabold text-navy hover:border-teal hover:bg-teal-pale disabled:cursor-not-allowed disabled:opacity-[.55]";

const SIGNAL_LABELS = {
  category: "カテゴリ",
  keyIssue: "論点",
  propertyState: "物件状態",
  rights: "権利関係",
  specialty: "得意領域",
  strength: "経験",
  tag: "特徴",
} as const satisfies Record<string, string>;

export function ToolResult({
  part,
  canRespond,
  onRespond,
  onRequestConsultation,
  onFocusComposer,
  onAnnounce,
}: {
  readonly part: EveDynamicToolPart;
  readonly canRespond: boolean;
  readonly onRespond: EveInputResponder;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly onFocusComposer: () => void;
  readonly onAnnounce: (message: string) => void;
}) {
  const request = part.toolMetadata?.eve?.inputRequest;

  if (part.state === "output-available") {
    switch (part.toolName) {
      case "analyze_case": {
        const result = AnalyzeCaseOutputSchema.safeParse(part.output);
        return result.success
          ? <AnalysisReport output={result.data} canRespond={canRespond} onRequestConsultation={onRequestConsultation} onFocusComposer={onFocusComposer} />
          : <InvalidToolResult name={part.toolName} />;
      }
      case "draft_consultation_request": {
        const result = DraftConsultationOutputSchema.safeParse(part.output);
        return result.success
          ? <ConsultationDraftCard output={result.data} onAnnounce={onAnnounce} />
          : <InvalidToolResult name={part.toolName} />;
      }
      case "search_similar_cases": {
        const result = SimilarCaseSearchResultSchema.safeParse(part.output);
        return result.success
          ? <SimilarCasesCard result={result.data} />
          : <InvalidToolResult name={part.toolName} />;
      }
      case "search_guides": {
        const result = GuideSearchResultSchema.safeParse(part.output);
        return result.success
          ? <GuidesCard result={result.data} />
          : <InvalidToolResult name={part.toolName} />;
      }
      case "search_experts": {
        const result = ExpertSearchResultSchema.safeParse(part.output);
        return result.success
          ? <ExpertsCard result={result.data} canRespond={canRespond} onRequestConsultation={onRequestConsultation} />
          : <InvalidToolResult name={part.toolName} />;
      }
      default:
        return (
          <section className={TOOL_PROGRESS}>
            <div className="flex items-center gap-[9px]"><span className="size-[9px] rounded-full bg-teal" aria-hidden="true" /><strong>{toolLabel(part.toolName)}</strong></div>
            <span className="text-ink-soft">完了</span>
          </section>
        );
    }
  }

  if (part.state === "output-error") {
    return <p className={TOOL_ERROR} role="alert">{toolLabel(part.toolName, "処理")}に失敗しました。</p>;
  }

  return (
    <section className={TOOL_PROGRESS}>
      <div className="flex items-center gap-[9px]">
        <span className="size-[9px] animate-tool-spin rounded-full border-2 border-teal border-t-transparent" aria-hidden="true" />
        <strong>{toolLabel(part.toolName, "案件情報を確認中")}</strong>
      </div>
      <span className="text-ink-soft">処理中</span>
      {request ? (
        <div className="col-span-full grid gap-2.5 border-t border-line pt-2.5">
          <p className="m-0">{request.prompt}</p>
          <div>
            {request.options?.map((option) => (
              <button className={SECONDARY_BUTTON} key={option.id} type="button" disabled={!canRespond} onClick={() => void onRespond(request.requestId, option.id)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AnalysisReport({
  output,
  canRespond,
  onRequestConsultation,
  onFocusComposer,
}: {
  readonly output: AnalyzeCaseOutput;
  readonly canRespond: boolean;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly onFocusComposer: () => void;
}) {
  const { report } = output;
  const reportId = useId();
  const sectionOffset = report.reanalysisChanges === null ? 0 : 1;

  function sectionId(section: string) {
    return `${reportId}-${section}`;
  }

  function sectionNumber(base: number) {
    return String(base + sectionOffset).padStart(2, "0");
  }

  return (
    <article className={cn(CARD, output.analysisType === "reanalysis" && "border-t-4 border-t-teal")}>
      <header className="flex flex-wrap items-center justify-between gap-3.5 border-b-2 border-navy pb-[18px]">
        <div className="flex items-center gap-3.5">
          <span className="border border-navy px-[9px] py-1.5 text-[0.62rem] font-black tracking-[0.14em] text-navy">初動報告</span>
          <div>
            <p className="mb-0.5 text-[0.68rem] font-extrabold tracking-[0.1em] text-[#176c67]">{output.analysisLabel}</p>
            <h2 className="m-0 font-display text-[1.45rem] font-semibold">初動整理レポート</h2>
          </div>
        </div>
        <PriorityBadge level={report.priority.level} label={output.priorityLabel} />
      </header>

      <section className="grid gap-3.5" aria-labelledby={sectionId("summary")}>
        <SectionTitle number="01" id={sectionId("summary")}>案件要約</SectionTitle>
        <dl className="grid grid-cols-2 gap-px border border-line bg-line max-md:grid-cols-1">
          <SummaryItem term="案件種別" value={output.categoryLabel ?? "要確認"} />
          <SummaryItem term="物件状態" value={formatItems(report.caseSummary.propertyState)} />
          <SummaryItem term="権利関係" value={formatItems(report.caseSummary.rights)} />
          <SummaryItem term="関係者" value={formatItems(report.caseSummary.stakeholders)} />
          <SummaryItem term="顧客の希望" value={report.caseSummary.customerWish} wide />
          <SummaryItem term="現在の問題" value={report.caseSummary.currentProblem} wide />
        </dl>
        {report.caseSummary.unknowns.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2.5 rounded-[9px] border border-[#e4d3ad] bg-amber-pale px-3.5 py-[11px] text-[0.76rem] text-[#654c1d]"><strong>不明点</strong><TagList items={report.caseSummary.unknowns} /></div>
        ) : null}
      </section>

      {report.reanalysisChanges ? (
        <section className="grid gap-3.5 rounded-r-[10px] border border-control-line border-l-4 border-l-teal bg-[#f4faf8] px-[18px] py-4" aria-labelledby={sectionId("changes")}>
          <SectionTitle number="02" id={sectionId("changes")}>前回分析からの更新</SectionTitle>
          <div className="grid gap-[26px] md:grid-cols-2">
            <div>
              <h4 className="mt-0 mb-2.5 text-[0.82rem] text-navy">解消した不明点</h4>
              <NumberedList items={report.reanalysisChanges.resolvedUnknowns} empty="今回解消した不明点はありません" />
            </div>
            <div>
              <h4 className="mt-0 mb-2.5 text-[0.82rem] text-navy">新たに判明した事実</h4>
              <NumberedList items={report.reanalysisChanges.newFacts} empty="新たに判明した事実はありません" />
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3.5" aria-labelledby={sectionId("priority")}>
        <SectionTitle number={sectionNumber(2)} id={sectionId("priority")}>優先度と理由</SectionTitle>
        <div className={cn("grid gap-3 rounded-r-[10px] border-l-4 border-l-teal bg-[#f7faf9] px-[18px] py-4 [&>ul]:m-0 [&>ul]:grid [&>ul]:gap-1.5 [&>ul]:pl-5 [&>ul]:text-[0.86rem] [&>ul]:leading-[1.7] [&>p]:m-0 [&>p]:text-[0.72rem] [&>p]:text-ink-soft", report.priority.level === "safety_first" && "border-l-danger bg-[#fdf3f3]", (report.priority.level === "early_check" || report.priority.level === "needs_review") && "border-l-amber bg-amber-pale")}>
          <PriorityBadge level={report.priority.level} label={output.priorityLabel} />
          <ul>{uniqueStrings(report.priority.reasons).map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p>法的な緊急性の判定ではなく、入力内容を整理する目安です。</p>
        </div>
      </section>

      <div className="grid gap-[26px] md:grid-cols-2">
        <section className="grid gap-3.5" aria-labelledby={sectionId("missing")}>
          <SectionTitle number={sectionNumber(3)} id={sectionId("missing")}>不足情報</SectionTitle>
          <NumberedList items={report.missingInfo} empty="不足情報はありません" />
        </section>
        <section className="grid gap-3.5" aria-labelledby={sectionId("actions")}>
          <SectionTitle number={sectionNumber(4)} id={sectionId("actions")}>初動確認事項</SectionTitle>
          <NumberedList items={report.actionItems} empty="確認事項はありません" />
        </section>
      </div>

      <section className="grid gap-3.5" aria-labelledby={sectionId("evidence")}>
        <SectionTitle number={sectionNumber(5)} id={sectionId("evidence")}>参照根拠</SectionTitle>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <SimilarCasesCard result={report.similarCases} embedded />
          <GuidesCard result={report.guides} embedded />
        </div>
      </section>

      <section className="grid gap-3.5" aria-labelledby={sectionId("experts")}>
        <SectionTitle number={sectionNumber(6)} id={sectionId("experts")}>有識者候補</SectionTitle>
        <ExpertsCard result={report.experts} embedded canRespond={canRespond} onRequestConsultation={onRequestConsultation} />
      </section>

      <section className="grid gap-3.5 rounded-r-[10px] border border-[#e4d3ad] border-l-4 border-l-amber bg-amber-pale px-[18px] py-4 [&>div]:border-b-[#e4d3ad] [&>ul]:m-0 [&>ul]:grid [&>ul]:gap-1.5 [&>ul]:pl-5 [&>ul]:text-[0.85rem] [&>ul]:leading-[1.7] [&>ul]:text-[#4d3a12] [&>p]:m-0 [&>p]:text-[0.74rem] [&>p]:font-bold [&>p]:text-[#6d5011]" aria-labelledby={sectionId("human")}>
        <SectionTitle number={sectionNumber(7)} id={sectionId("human")}>人間・専門家の確認が必要</SectionTitle>
        <ul>{uniqueStrings(report.humanEscalation).map((item) => <li key={item}>{item}</li>)}</ul>
        <p>最終判断と実際の連絡は、担当者または適切な専門家が行ってください。</p>
      </section>

      <section className="flex flex-wrap items-center gap-4 rounded-xl bg-navy-deep px-5 py-[18px] text-white" aria-labelledby={sectionId("question")}>
        <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-white/14 font-black" aria-hidden="true">?</span>
        <div className="min-w-[220px] flex-1"><p className="mb-1 text-[0.68rem] font-extrabold tracking-[0.08em] text-[#a9cbc7]">次に確認したいこと</p><h3 className="m-0 text-base leading-[1.6]" id={sectionId("question")}>{report.followUpQuestion}</h3></div>
        <button className={`${SECONDARY_BUTTON} max-sm:w-full`} type="button" disabled={!canRespond} onClick={onFocusComposer}>
          追加情報を入力して再分析 <span aria-hidden="true">↓</span>
        </button>
      </section>
    </article>
  );
}

function SimilarCasesCard({ result, embedded = false }: { readonly result: SimilarCaseSearchResult; readonly embedded?: boolean }) {
  return (
    <section className={embedded ? "grid content-start gap-3 rounded-[10px] border border-line bg-[#fbfdfc] p-3.5" : "mt-3.5 grid gap-3.5 rounded-[4px_14px_4px_4px] border border-[#c9d7d4] bg-paper p-5"}>
      <header className="flex flex-wrap items-center justify-between gap-2.5"><div className="flex items-center gap-2"><span className="font-black text-[#176c67]" aria-hidden="true">▤</span><h3 className="m-0 text-[0.88rem] tracking-[0.03em]">類似事例</h3></div><EvidenceStatus sufficient={result.hasSufficientEvidence} /></header>
      {result.matches.length > 0 ? (
        <ol className="m-0 grid list-none gap-3 p-0" role="list">
          {result.matches.map((match, index) => (
            <li className="flex gap-3 rounded-[10px] border border-line bg-paper p-3" key={match.case.id}>
              <div className="shrink-0 font-display text-[1.3rem] leading-none text-[#8ba39e]">{String(index + 1).padStart(2, "0")}</div>
              <div className="grid min-w-0 gap-[7px]">
                <div className="flex flex-wrap items-center gap-2.5 text-[0.68rem]"><code className="rounded-[5px] border border-[#a8cbc7] bg-teal-pale px-[7px] py-0.5 font-bold text-[#0f5b56]">{match.case.id}</code><span className="font-bold text-ink-soft">{CASE_CATEGORY_LABELS[match.case.category]}</span><strong className="ml-auto text-navy">{match.score} 点</strong></div>
                <h4 className="m-0 text-[0.86rem] leading-[1.6]">{match.case.summary}</h4>
                <p className="m-0 text-[0.78rem] leading-[1.7] text-ink-soft">{match.case.initialResponse}</p>
                <ReasonList reasons={match.reasons} />
              </div>
            </li>
          ))}
        </ol>
      ) : <NoEvidence />}
    </section>
  );
}

function GuidesCard({ result, embedded = false }: { readonly result: GuideSearchResult; readonly embedded?: boolean }) {
  return (
    <section className={embedded ? "grid content-start gap-3 rounded-[10px] border border-line bg-[#fbfdfc] p-3.5" : "mt-3.5 grid gap-3.5 rounded-[4px_14px_4px_4px] border border-[#c9d7d4] bg-paper p-5"}>
      <header className="flex flex-wrap items-center justify-between gap-2.5"><div className="flex items-center gap-2"><span className="font-black text-[#176c67]" aria-hidden="true">✓</span><h3 className="m-0 text-[0.88rem] tracking-[0.03em]">社内初動ガイド</h3></div><EvidenceStatus sufficient={result.hasSufficientEvidence} /></header>
      {result.matches.length > 0 ? (
        <ol className="m-0 grid list-none gap-3 p-0" role="list">
          {result.matches.map((match, index) => (
            <li className="flex gap-3 rounded-[10px] border border-line bg-paper p-3" key={match.guide.id}>
              <div className="shrink-0 font-display text-[1.3rem] leading-none text-[#8ba39e]">{String(index + 1).padStart(2, "0")}</div>
              <div className="grid min-w-0 gap-[7px]">
                <div className="flex flex-wrap items-center gap-2.5 text-[0.68rem]"><code className="rounded-[5px] border border-[#a8cbc7] bg-teal-pale px-[7px] py-0.5 font-bold text-[#0f5b56]">{match.guide.id}</code><span className="font-bold text-ink-soft">{match.guide.area}</span><strong className="ml-auto text-navy">{match.score} 点</strong></div>
                <h4 className="m-0 text-[0.86rem] leading-[1.6]">{match.guide.title}</h4>
                <ul className="m-0 grid list-disc gap-1 pl-[18px] text-[0.76rem] leading-[1.6] text-ink-soft">{match.guide.checkItems.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                <ReasonList reasons={match.reasons} />
              </div>
            </li>
          ))}
        </ol>
      ) : <NoEvidence />}
    </section>
  );
}

function ExpertsCard({
  result,
  embedded = false,
  canRespond,
  onRequestConsultation,
}: {
  readonly result: ExpertSearchResult;
  readonly embedded?: boolean;
  readonly canRespond: boolean;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
}) {
  return (
    <section className={embedded ? "grid gap-3" : "mt-3.5 grid gap-3.5 rounded-[4px_14px_4px_4px] border border-[#c9d7d4] bg-paper p-5"}>
      {!embedded ? <header className="flex flex-wrap items-center justify-between gap-2.5"><div className="flex items-center gap-2"><span className="font-black text-[#176c67]" aria-hidden="true">◎</span><h3 className="m-0 text-[0.88rem] tracking-[0.03em]">有識者候補</h3></div><EvidenceStatus sufficient={result.hasSufficientEvidence} /></header> : null}
      {result.matches.length > 0 ? (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
          {result.matches.map((match, index) => (
            <article key={match.expert.id} className="grid content-start gap-[9px] rounded-[4px_14px_4px_4px] border border-line bg-paper p-4">
              <div className="flex items-center gap-[9px] text-[0.68rem]"><span className="font-display text-[1.1rem] text-[#8ba39e]">{String(index + 1).padStart(2, "0")}</span><code className="rounded-[5px] border border-[#a8cbc7] bg-teal-pale px-[7px] py-0.5 font-bold text-[#0f5b56]">{match.expert.id}</code><strong className="ml-auto text-navy">{match.score} 点</strong></div>
              <h4 className="m-0 font-display text-[1.05rem]">{match.expert.name}</h4>
              <p className="m-0 text-[0.74rem] text-ink-soft">{match.expert.department}</p>
              <TagList items={match.expert.specialties.map((category) => CASE_CATEGORY_LABELS[category])} />
              <p className="m-0 text-[0.78rem] leading-[1.7]">{match.recommendation}</p>
              <dl className="m-0 grid gap-2 rounded-lg bg-[#f2f6f5] px-3 py-2.5 text-[0.72rem]"><div className="flex justify-between gap-2.5"><dt className="shrink-0 font-bold text-ink-soft">関連案件</dt><dd className="m-0 text-right font-bold">{match.expert.relatedCaseCount}件</dd></div><div className="flex justify-between gap-2.5"><dt className="shrink-0 font-bold text-ink-soft">得意領域</dt><dd className="m-0 text-right font-bold">{match.expert.strengths.join("・")}</dd></div></dl>
              <button className={SECONDARY_BUTTON} type="button" disabled={!canRespond} onClick={() => void onRequestConsultation(match.expert)}>
                この人への相談文を作成 <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
      ) : <NoEvidence />}
    </section>
  );
}

function ConsultationDraftCard({ output, onAnnounce }: { readonly output: DraftConsultationOutput; readonly onAnnounce: (message: string) => void }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  if (!output.ok) return <p className={TOOL_ERROR} role="alert">{output.message}</p>;
  const { draft } = output;

  async function copyDraft() {
    const result = await Result.tryPromise({
      try: () => navigator.clipboard.writeText(`件名：${draft.subject}\n\n${draft.body}`),
      catch: cause => cause,
    });
    if (Result.isError(result)) {
      setCopyStatus("error");
      onAnnounce("相談依頼文をコピーできませんでした。本文を選択してコピーしてください。");
      return;
    }

    setCopyStatus("copied");
    onAnnounce("相談依頼文をクリップボードへコピーしました。");
  }

  return (
    <article className={CARD}>
      <header className="flex flex-wrap items-center justify-between gap-3.5 border-b-2 border-navy pb-[18px] max-sm:flex-col max-sm:items-stretch">
        <div className="flex items-center gap-3.5"><span className="border border-navy px-[9px] py-1.5 text-[0.62rem] font-black tracking-[0.14em] text-navy">下書き</span><div><p className="mb-0.5 text-[0.68rem] font-extrabold tracking-[0.1em] text-[#176c67]">社内向け・未送信</p><h2 className="m-0 font-display text-[1.45rem] font-semibold">相談依頼文</h2></div></div>
        <button className={`${SECONDARY_BUTTON} max-sm:w-full`} type="button" onClick={copyDraft}>{copyStatus === "copied" ? "コピー済み" : "全文をコピー"}</button>
      </header>
      <dl className="m-0 grid gap-2.5 text-[0.82rem]">
        <div className="flex gap-3"><dt className="w-[52px] shrink-0 pt-0.5 text-[0.72rem] font-extrabold text-ink-soft">宛先</dt><dd className="m-0 font-semibold">{draft.recipient.name}（{draft.recipient.department}）</dd></div>
        <div className="flex gap-3"><dt className="w-[52px] shrink-0 pt-0.5 text-[0.72rem] font-extrabold text-ink-soft">件名</dt><dd className="m-0 font-semibold">{draft.subject}</dd></div>
      </dl>
      <pre className="m-0 overflow-x-auto rounded-[10px] border border-line bg-[#f7faf9] p-4 font-sans text-[0.85rem] leading-[1.85] whitespace-pre-wrap">{draft.body}</pre>
      <p className="m-0 rounded-[9px] border border-[#e4d3ad] bg-amber-pale px-3.5 py-[11px] text-[0.74rem] leading-[1.6] text-[#654c1d]">{draft.piiNotice}</p>
      <p className="m-0 min-h-[1.2em] text-[0.72rem] font-bold text-[#105e59]">
        {copyStatus === "copied" ? "相談依頼文をクリップボードへコピーしました。" : copyStatus === "error" ? "コピーできませんでした。本文を選択してコピーしてください。" : ""}
      </p>
    </article>
  );
}

function PriorityBadge({ level, label }: { readonly level: PriorityLevel; readonly label: string }) {
  return <span className={cn("inline-flex min-h-[30px] shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[0.74rem] font-extrabold before:size-2 before:rounded-sm before:bg-current before:content-['']", level === "safety_first" && "border-[#cf9b9b] bg-[#fdf0f0] text-[#8f2323]", level === "early_check" && "border-[#d9b565] bg-amber-pale text-[#6d5011]", level === "normal" && "border-[#a8cbc7] bg-teal-pale text-[#105e59]", level === "needs_review" && "border-dashed border-[#c4a75c] bg-[#fffcf2] text-[#6d5011]")}>{label}</span>;
}

function SectionTitle({ children, id, number }: { readonly children: string; readonly id: string; readonly number: string }) {
  return <div className="flex items-baseline gap-2.5 border-b border-line pb-2"><span className="text-[0.7rem] font-black tracking-[0.08em] text-[#176c67]">{number}</span><h3 className="m-0 text-[0.95rem] tracking-[0.03em]" id={id}>{children}</h3></div>;
}

function SummaryItem({ term, value, wide = false }: { readonly term: string; readonly value: string; readonly wide?: boolean }) {
  return <div className={cn("grid gap-[5px] bg-[#fbfdfc] px-3.5 py-3", wide && "col-span-full max-md:col-auto")}><dt className="text-[0.68rem] font-extrabold tracking-[0.06em] text-ink-soft">{term}</dt><dd className="m-0 text-[0.88rem] font-semibold leading-[1.7]">{value}</dd></div>;
}

function NumberedList({ items, empty }: { readonly items: readonly string[]; readonly empty: string }) {
  if (items.length === 0) return <p className="m-0 rounded-[9px] border border-dashed border-[#b9c9c6] px-3.5 py-3 text-[0.8rem] text-ink-soft">{empty}</p>;
  return <ol className="m-0 grid list-none gap-2.5 p-0" role="list">{uniqueStrings(items).map((item, index) => <li className="flex gap-3 rounded-[9px] border border-line bg-[#fbfdfc] px-3 py-2.5" key={item}><span className="text-[0.7rem] font-black text-[#176c67]">{String(index + 1).padStart(2, "0")}</span><p className="m-0 text-[0.85rem] leading-[1.7]">{item}</p></li>)}</ol>;
}

function TagList({ items }: { readonly items: readonly string[] }) {
  return <div className="flex flex-wrap gap-1.5">{uniqueStrings(items).map((item) => <span className="rounded-full border border-[#b6cac7] bg-white px-[9px] py-[3px] text-[0.68rem] font-bold text-[#3c5652]" key={item}>{item}</span>)}</div>;
}

function ReasonList({ reasons }: { readonly reasons: readonly MatchReason[] }) {
  const labels = uniqueStrings(reasons.flatMap((reason) => reason.matched.map((matched) => `${SIGNAL_LABELS[reason.signal] ?? reason.signal}: ${matched}`)));
  return labels.length > 0 ? <div className="flex flex-wrap gap-1.5">{labels.map((label) => <span className="rounded-[5px] bg-teal-pale px-2 py-[3px] text-[0.66rem] font-bold text-[#0f5b56]" key={label}>{label}</span>)}</div> : null;
}

function uniqueStrings(items: readonly string[]) {
  return [...new Set(items)];
}

function EvidenceStatus({ sufficient }: { readonly sufficient: boolean }) {
  return <span className={cn("inline-flex min-h-[26px] shrink-0 items-center gap-[7px] rounded-full border px-2.5 py-0.5 text-[0.68rem] font-extrabold before:text-[0.5rem]", sufficient ? "border-[#a8cbc7] bg-teal-pale text-[#105e59] before:content-['●']" : "border-dashed border-[#d9b565] bg-amber-pale text-[#6d5011] before:content-['▲']")}>{sufficient ? "根拠あり" : "十分な根拠なし"}</span>;
}

function NoEvidence() {
  return <p className="m-0 grid gap-1.5 rounded-[10px] border border-dashed border-[#c4a75c] bg-amber-pale p-3.5 text-[0.78rem] leading-[1.6] text-[#654c1d]"><strong>十分な根拠なし</strong><span>条件に合う候補を確認できませんでした。推測で候補を補っていません。</span></p>;
}

function InvalidToolResult({ name }: { readonly name: string }) {
  return <p className={TOOL_ERROR} role="alert">{toolLabel(name, "ツール")}の結果を表示できませんでした。</p>;
}

function toolLabel(name: string, fallback = name) {
  return name in TOOL_LABELS ? TOOL_LABELS[name as keyof typeof TOOL_LABELS] : fallback;
}

function formatItems(items: readonly string[]) {
  return items.length > 0 ? items.join("・") : "要確認";
}
