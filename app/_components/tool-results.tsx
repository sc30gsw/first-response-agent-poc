"use client";

import type { EveDynamicToolPart } from "eve/react";
import { useId, useState } from "react";
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
import { CASE_CATEGORY_LABELS } from "@/shared/tools/first-response";

const TOOL_LABELS = {
  analyze_case: "初動レポート",
  draft_consultation_request: "相談依頼文",
  search_experts: "有識者候補",
  search_guides: "社内初動ガイド",
  search_similar_cases: "類似事例",
} as const satisfies Record<string, string>;

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
}: {
  readonly part: EveDynamicToolPart;
  readonly canRespond: boolean;
  readonly onRespond: (requestId: string, optionId: string) => Promise<void>;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly onFocusComposer: () => void;
}) {
  const request = part.toolMetadata?.eve?.inputRequest;

  if (part.state === "output-available") {
    switch (part.toolName) {
      case "analyze_case":
        return isAnalyzeCaseOutput(part.output)
          ? <AnalysisReport output={part.output} canRespond={canRespond} onRequestConsultation={onRequestConsultation} onFocusComposer={onFocusComposer} />
          : <InvalidToolResult name={part.toolName} />;
      case "draft_consultation_request":
        return isDraftOutput(part.output)
          ? <ConsultationDraftCard output={part.output} />
          : <InvalidToolResult name={part.toolName} />;
      case "search_similar_cases":
        return isEvidenceResult(part.output)
          ? <SimilarCasesCard result={part.output as SimilarCaseSearchResult} />
          : <InvalidToolResult name={part.toolName} />;
      case "search_guides":
        return isEvidenceResult(part.output)
          ? <GuidesCard result={part.output as GuideSearchResult} />
          : <InvalidToolResult name={part.toolName} />;
      case "search_experts":
        return isEvidenceResult(part.output)
          ? <ExpertsCard result={part.output as ExpertSearchResult} canRespond={canRespond} onRequestConsultation={onRequestConsultation} />
          : <InvalidToolResult name={part.toolName} />;
      default:
        return (
          <section className="tool-progress">
            <div><span className="tool-dot tool-dot--complete" aria-hidden="true" /><strong>{toolLabel(part.toolName)}</strong></div>
            <span>完了</span>
          </section>
        );
    }
  }

  if (part.state === "output-error") {
    return <p className="tool-error" role="alert">{toolLabel(part.toolName, "処理")}に失敗しました。</p>;
  }

  return (
    <section className="tool-progress">
      <div>
        <span className="tool-dot" aria-hidden="true" />
        <strong>{toolLabel(part.toolName, "案件情報を確認中")}</strong>
      </div>
      <span>処理中</span>
      {request ? (
        <div className="input-request">
          <p>{request.prompt}</p>
          <div>
            {request.options?.map((option) => (
              <button key={option.id} type="button" disabled={!canRespond} onClick={() => void onRespond(request.requestId, option.id)}>
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

  function sectionId(section: string) {
    return `${reportId}-${section}`;
  }

  return (
    <article className={output.analysisType === "reanalysis" ? "analysis-report analysis-report--reanalysis" : "analysis-report"}>
      <header className="report-header">
        <div>
          <span className="report-index">REPORT</span>
          <div>
            <p>{output.analysisLabel}</p>
            <h2>初動整理レポート</h2>
          </div>
        </div>
        <PriorityBadge level={report.priority.level} label={output.priorityLabel} />
      </header>

      <section className="report-section" aria-labelledby={sectionId("summary")}>
        <SectionTitle number="01" id={sectionId("summary")}>案件要約</SectionTitle>
        <dl className="summary-grid">
          <SummaryItem term="案件種別" value={output.categoryLabel ?? "要確認"} />
          <SummaryItem term="物件状態" value={formatItems(report.caseSummary.propertyState)} />
          <SummaryItem term="権利関係" value={formatItems(report.caseSummary.rights)} />
          <SummaryItem term="関係者" value={formatItems(report.caseSummary.stakeholders)} />
          <SummaryItem term="顧客の希望" value={report.caseSummary.customerWish} wide />
          <SummaryItem term="現在の問題" value={report.caseSummary.currentProblem} wide />
        </dl>
        {report.caseSummary.unknowns.length > 0 ? (
          <div className="unknown-strip"><strong>不明点</strong><TagList items={report.caseSummary.unknowns} /></div>
        ) : null}
      </section>

      <section className="report-section" aria-labelledby={sectionId("priority")}>
        <SectionTitle number="02" id={sectionId("priority")}>優先度と理由</SectionTitle>
        <div className={`priority-panel priority-panel--${report.priority.level}`}>
          <PriorityBadge level={report.priority.level} label={output.priorityLabel} />
          <ul>{report.priority.reasons.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}</ul>
          <p>法的な緊急性の判定ではなく、入力内容を整理する目安です。</p>
        </div>
      </section>

      <div className="report-split">
        <section className="report-section" aria-labelledby={sectionId("missing")}>
          <SectionTitle number="03" id={sectionId("missing")}>不足情報</SectionTitle>
          <NumberedList items={report.missingInfo} empty="不足情報はありません" />
        </section>
        <section className="report-section" aria-labelledby={sectionId("actions")}>
          <SectionTitle number="04" id={sectionId("actions")}>初動確認事項</SectionTitle>
          <NumberedList items={report.actionItems} empty="確認事項はありません" />
        </section>
      </div>

      <section className="report-section evidence-section" aria-labelledby={sectionId("evidence")}>
        <SectionTitle number="05" id={sectionId("evidence")}>参照根拠</SectionTitle>
        <div className="evidence-columns">
          <SimilarCasesCard result={report.similarCases} embedded />
          <GuidesCard result={report.guides} embedded />
        </div>
      </section>

      <section className="report-section" aria-labelledby={sectionId("experts")}>
        <SectionTitle number="06" id={sectionId("experts")}>有識者候補</SectionTitle>
        <ExpertsCard result={report.experts} embedded canRespond={canRespond} onRequestConsultation={onRequestConsultation} />
      </section>

      <section className="report-section human-check" aria-labelledby={sectionId("human")}>
        <SectionTitle number="07" id={sectionId("human")}>人間・専門家の確認が必要</SectionTitle>
        <ul>{report.humanEscalation.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}</ul>
        <p>最終判断と実際の連絡は、担当者または適切な専門家が行ってください。</p>
      </section>

      <section className="follow-up-question" aria-labelledby={sectionId("question")}>
        <span aria-hidden="true">?</span>
        <div><p>次に確認したいこと</p><h3 id={sectionId("question")}>{report.followUpQuestion}</h3></div>
        <button type="button" disabled={!canRespond} onClick={onFocusComposer}>
          追加情報を入力して再分析 <span aria-hidden="true">↓</span>
        </button>
      </section>
    </article>
  );
}

function SimilarCasesCard({ result, embedded = false }: { readonly result: SimilarCaseSearchResult; readonly embedded?: boolean }) {
  return (
    <section className={embedded ? "evidence-card" : "standalone-tool-card"}>
      <header><div><span aria-hidden="true">▤</span><h3>類似事例</h3></div><EvidenceStatus sufficient={result.hasSufficientEvidence} /></header>
      {result.matches.length > 0 ? (
        <ol className="match-list">
          {result.matches.map((match, index) => (
            <li key={match.case.id}>
              <div className="match-rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="match-content">
                <div className="match-meta"><code>{match.case.id}</code><span>{CASE_CATEGORY_LABELS[match.case.category]}</span><strong>{match.score} pt</strong></div>
                <h4>{match.case.summary}</h4>
                <p>{match.case.initialResponse}</p>
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
    <section className={embedded ? "evidence-card" : "standalone-tool-card"}>
      <header><div><span aria-hidden="true">✓</span><h3>社内初動ガイド</h3></div><EvidenceStatus sufficient={result.hasSufficientEvidence} /></header>
      {result.matches.length > 0 ? (
        <ol className="match-list guide-list">
          {result.matches.map((match, index) => (
            <li key={match.guide.id}>
              <div className="match-rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="match-content">
                <div className="match-meta"><code>{match.guide.id}</code><span>{match.guide.area}</span><strong>{match.score} pt</strong></div>
                <h4>{match.guide.title}</h4>
                <ul className="compact-list">{match.guide.checkItems.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
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
    <section className={embedded ? "experts-embedded" : "standalone-tool-card"}>
      {!embedded ? <header><div><span aria-hidden="true">◎</span><h3>有識者候補</h3></div><EvidenceStatus sufficient={result.hasSufficientEvidence} /></header> : null}
      {result.matches.length > 0 ? (
        <div className="expert-grid">
          {result.matches.map((match, index) => (
            <article key={match.expert.id} className="expert-card">
              <div className="expert-topline"><span>{String(index + 1).padStart(2, "0")}</span><code>{match.expert.id}</code><strong>{match.score} pt</strong></div>
              <h4>{match.expert.name}</h4>
              <p className="expert-department">{match.expert.department}</p>
              <TagList items={match.expert.specialties.map((category) => CASE_CATEGORY_LABELS[category])} />
              <p>{match.recommendation}</p>
              <dl><div><dt>関連案件</dt><dd>{match.expert.relatedCaseCount}件</dd></div><div><dt>得意領域</dt><dd>{match.expert.strengths.join("・")}</dd></div></dl>
              <button type="button" disabled={!canRespond} onClick={() => void onRequestConsultation(match.expert)}>
                この人への相談文を作成 <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
      ) : <NoEvidence />}
    </section>
  );
}

function ConsultationDraftCard({ output }: { readonly output: DraftConsultationOutput }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  if (!output.ok) return <p className="tool-error" role="alert">{output.message}</p>;
  const { draft } = output;

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`件名：${draft.subject}\n\n${draft.body}`);
      setCopyStatus("copied");
    }
    catch {
      setCopyStatus("error");
    }
  }

  return (
    <article className="consultation-draft">
      <header className="report-header">
        <div><span className="report-index">DRAFT</span><div><p>社内向け・未送信</p><h2>相談依頼文</h2></div></div>
        <button type="button" onClick={copyDraft}>{copyStatus === "copied" ? "コピー済み" : "全文をコピー"}</button>
      </header>
      <dl className="draft-meta">
        <div><dt>宛先</dt><dd>{draft.recipient.name}（{draft.recipient.department}）</dd></div>
        <div><dt>件名</dt><dd>{draft.subject}</dd></div>
      </dl>
      <pre>{draft.body}</pre>
      <p className="draft-notice">{draft.piiNotice}</p>
      <p className="copy-status" aria-live="polite">
        {copyStatus === "copied" ? "相談依頼文をクリップボードへコピーしました。" : copyStatus === "error" ? "コピーできませんでした。本文を選択してコピーしてください。" : ""}
      </p>
    </article>
  );
}

function PriorityBadge({ level, label }: { readonly level: PriorityLevel; readonly label: string }) {
  return <span className={`priority-badge priority-badge--${level}`}>{label}</span>;
}

function SectionTitle({ children, id, number }: { readonly children: string; readonly id: string; readonly number: string }) {
  return <div className="report-section-title"><span>{number}</span><h3 id={id}>{children}</h3></div>;
}

function SummaryItem({ term, value, wide = false }: { readonly term: string; readonly value: string; readonly wide?: boolean }) {
  return <div className={wide ? "summary-item summary-item--wide" : "summary-item"}><dt>{term}</dt><dd>{value}</dd></div>;
}

function NumberedList({ items, empty }: { readonly items: readonly string[]; readonly empty: string }) {
  if (items.length === 0) return <p className="empty-result">{empty}</p>;
  return <ol className="numbered-checks">{items.map((item, index) => <li key={`${index}:${item}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol>;
}

function TagList({ items }: { readonly items: readonly string[] }) {
  return <div className="tag-list">{items.map((item, index) => <span key={`${index}:${item}`}>{item}</span>)}</div>;
}

function ReasonList({ reasons }: { readonly reasons: readonly MatchReason[] }) {
  const labels = reasons.flatMap((reason) => reason.matched.map((matched) => `${SIGNAL_LABELS[reason.signal] ?? reason.signal}: ${matched}`));
  return labels.length > 0 ? <div className="reason-list">{labels.map((label, index) => <span key={`${index}:${label}`}>{label}</span>)}</div> : null;
}

function EvidenceStatus({ sufficient }: { readonly sufficient: boolean }) {
  return <span className={sufficient ? "evidence-status" : "evidence-status evidence-status--none"}>{sufficient ? "根拠あり" : "十分な根拠なし"}</span>;
}

function NoEvidence() {
  return <p className="no-evidence"><strong>十分な根拠なし</strong><span>条件に合う候補を確認できませんでした。推測で候補を補っていません。</span></p>;
}

function InvalidToolResult({ name }: { readonly name: string }) {
  return <p className="tool-error" role="alert">{toolLabel(name, "ツール")}の結果を表示できませんでした。</p>;
}

function toolLabel(name: string, fallback = name) {
  return name in TOOL_LABELS ? TOOL_LABELS[name as keyof typeof TOOL_LABELS] : fallback;
}

function formatItems(items: readonly string[]) {
  return items.length > 0 ? items.join("・") : "要確認";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAnalyzeCaseOutput(value: unknown): value is AnalyzeCaseOutput {
  return isRecord(value)
    && (value.analysisType === "initial" || value.analysisType === "reanalysis")
    && typeof value.analysisLabel === "string"
    && typeof value.priorityLabel === "string"
    && isRecord(value.report);
}

function isDraftOutput(value: unknown): value is DraftConsultationOutput {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (!value.ok) return typeof value.message === "string";
  if (!isRecord(value.draft) || !isRecord(value.draft.recipient)) return false;
  return typeof value.draft.subject === "string"
    && typeof value.draft.body === "string"
    && typeof value.draft.piiNotice === "string"
    && typeof value.draft.recipient.name === "string"
    && typeof value.draft.recipient.department === "string";
}

function isEvidenceResult(value: unknown): value is SimilarCaseSearchResult | GuideSearchResult | ExpertSearchResult {
  return isRecord(value) && Array.isArray(value.matches) && typeof value.hasSufficientEvidence === "boolean";
}
