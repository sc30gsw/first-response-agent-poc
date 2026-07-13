"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useEveAgent, type EveMessage } from "eve/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import { cn } from "cnfast";
import { z } from "zod";
import { clampChatMessage, MAX_CHAT_MESSAGE_CHARS } from "@/shared/chat-limits";
import {
  PersistedEveEventSchema,
  PersistedEveEventsSchema,
  type EveInputResponder,
  type EveInputSelection,
} from "@/shared/eve-events";
import {
  normalizeThreadSummary,
  type ThreadRecord,
  type ThreadSummary,
} from "@/shared/types/thread";
import type { Expert } from "@/shared/tools/first-response";
import { AnalyzeCaseOutputSchema, type AnalyzeCaseOutput } from "@/shared/tools/first-response";
import { AccessibleTooltip } from "./accessible-tooltip";
import { eveErrorMessage } from "./eve-error-message";
import { extractOpenUiBlock } from "./genui/extract-openui";
import { AnalysisGenUi, AnalysisGenUiSkeleton } from "./genui/renderer";
import { validateAnalysisGenUi } from "./genui/validation";
import { ToolResult } from "./tool-results";
import { useThreadPersistence } from "./use-thread-persistence";
import { WorkspaceShell } from "./workspace-shell";
import { useAppForm } from "./app-form";

type EveChatProps = {
  readonly thread: ThreadRecord;
  readonly threads: readonly ThreadSummary[];
};

const INPUT_EXAMPLES = [
  "共有者は3名で、そのうち1名とは連絡が取れていません。",
  "建物に傾きがあり、安全面が心配です。",
  "接道状況は不明で、売却までの期限もまだ決まっていません。",
] as const satisfies readonly string[];

const EYEBROW = "mb-3 text-[0.8rem] font-bold tracking-[0.12em] text-[#176c67]";
const PRIMARY_BUTTON = "inline-flex min-h-11 items-center justify-center gap-[22px] rounded-[10px] bg-navy px-[18px] py-2.5 font-bold text-white hover:bg-navy-deep disabled:cursor-wait disabled:opacity-[.62]";
const SECONDARY_BUTTON = "min-h-10 cursor-pointer rounded-lg border border-control-line bg-white px-3.5 py-2 font-extrabold text-navy hover:border-teal hover:bg-teal-pale disabled:cursor-wait disabled:opacity-[.62]";

// Pure read so the draft can hydrate the form's defaultValues during render.
// The matching sessionStorage removal happens after commit in EveChat's
// effect — reading and clearing in one step here would be a render side effect.
function readDraft(storageKey: string): string {
  if (typeof sessionStorage === "undefined") return "";
  const restored = Result.try({
    try: () => {
      const savedDraft = sessionStorage.getItem(storageKey);
      return savedDraft;
    },
    catch: cause => cause,
  });
  return !Result.isError(restored) && restored.value ? restored.value : "";
}

// Form creation lives in a top-level hook so ChatComposer's prop type can be
// derived from the SDK via ReturnType instead of restating the Field /
// Subscribe / handleSubmit API shapes by hand. Exported for the composer
// rendering test harness.
export function useChatMessageForm({ initialDraft, onSubmitMessage }: {
  readonly initialDraft: string;
  readonly onSubmitMessage: (message: string) => Promise<void>;
}) {
  return useAppForm({
    defaultValues: { message: initialDraft },
    validators: {
      onSubmit: z.object({
        message: z.string().trim().min(1, "相談内容を入力してください。"),
      }),
    },
    onSubmit: ({ value }) => onSubmitMessage(value.message),
  });
}

type ChatMessageForm = ReturnType<typeof useChatMessageForm>;

export function EveChat({ thread, threads }: EveChatProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftStorageKey = useRef(`thread-draft:${thread.id}`).current;
  const pendingComposerMessageRef = useRef<string | null>(null);
  const expectsAnalysisActionRef = useRef(false);
  const receivedAnalysisActionRef = useRef(false);
  const initialDraft = useMemo(() => readDraft(draftStorageKey), [draftStorageKey]);
  const [announcement, setAnnouncement] = useState("");
  const [isSendStarting, setIsSendStarting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const persistence = useThreadPersistence({ onAnnounce: setAnnouncement, queryClient, thread });
  // submitMessage is a hoisted function declaration below; useForm refreshes
  // its options (and this closure) on every render, so it never goes stale.
  const form = useChatMessageForm({
    initialDraft,
    onSubmitMessage: message => submitMessage(message),
  });

  // Remove the handed-off draft only after commit so render stays pure.
  useEffect(() => {
    if (!initialDraft || typeof sessionStorage === "undefined") return;
    void Result.try({
      try: () => sessionStorage.removeItem(draftStorageKey),
      catch: cause => cause,
    });
  }, [draftStorageKey, initialDraft]);

  const agent = useEveAgent({
    headers: { "x-thread-id": thread.id },
    initialEvents: thread.state?.events,
    initialSession: thread.state?.session,
    onError(error) {
      setIsSendStarting(false);
      const pendingMessage = pendingComposerMessageRef.current;
      if (pendingMessage) form.setFieldValue("message", pendingMessage);
      const message = eveErrorMessage(
        error,
        "処理に失敗しました。入力内容を確認して再度お試しください。",
      );
      setSendError(message);
      setAnnouncement(message);
    },
    onEvent(event) {
      const parsed = PersistedEveEventSchema.safeParse(event);
      if (!parsed.success) {
        persistence.blockSaving("未対応の会話イベントを受信したため、履歴の保存を停止しました。ページを再読み込みしてください。");
        return;
      }

      // Keep the immediate loading row through session/turn startup. Replace
      // it only when Eve has streamed content that the conversation can
      // actually render: text or a tool lifecycle update.
      if (
        parsed.data.type === "actions.requested"
        || parsed.data.type === "action.result"
        || parsed.data.type === "message.appended"
        || parsed.data.type === "message.completed"
      ) {
        setIsSendStarting(false);
      }

      if (
        parsed.data.type === "actions.requested"
        && parsed.data.data.actions.some(action => action.kind === "tool-call" && action.toolName === "analyze_case")
      ) {
        receivedAnalysisActionRef.current = true;
      }

      persistence.eventsRef.current = [...persistence.eventsRef.current, parsed.data];
      persistence.enqueueStateSave(persistence.currentThreadState());
    },
    onSessionChange(session) {
      persistence.sessionRef.current = { ...session };
      persistence.enqueueStateSave(persistence.currentThreadState());
    },
    onFinish(snapshot) {
      setIsSendStarting(false);
      const boundary = snapshot.events.at(-1)?.type;
      const completedWithoutAnalysis = !snapshot.error
        && expectsAnalysisActionRef.current
        && !receivedAnalysisActionRef.current
        && (boundary === "session.waiting" || boundary === "session.completed");

      if (completedWithoutAnalysis) {
        const pendingMessage = pendingComposerMessageRef.current;
        if (pendingMessage) form.setFieldValue("message", pendingMessage);
        const message = "AIが分析ツールを実行せずに回答を終了しました。入力内容を残したため、もう一度送信してください。";
        setSendError(message);
        setAnnouncement(message);
      } else if (!snapshot.error) {
        pendingComposerMessageRef.current = null;
        setSendError(null);
      }
      const parsedEvents = PersistedEveEventsSchema.safeParse(snapshot.events);
      if (parsedEvents.success) {
        persistence.eventsRef.current = parsedEvents.data;
        persistence.sessionRef.current = { ...snapshot.session };
        persistence.enqueueStateSave(persistence.currentThreadState());
      }

      if (!completedWithoutAnalysis && !snapshot.error && (boundary === "session.waiting" || boundary === "session.completed")) {
        setAnnouncement("初動支援AIの回答が完了しました。");
      }

      if (snapshot.error || boundary === "session.waiting" || boundary === "session.completed") {
        expectsAnalysisActionRef.current = false;
        receivedAnalysisActionRef.current = false;
      }
    },
  });
  const isAgentBusy = agent.status === "submitted" || agent.status === "streaming";
  const isBusy = isSendStarting || isAgentBusy;
  const hasStreamedAssistantContent = agent.data.messages.some(message => (
    message.role === "assistant" && hasVisibleMessageContent(message)
  ));
  const showImmediateLoading = isSendStarting && !hasStreamedAssistantContent;

  async function sendAgentInput(
    input: Parameters<typeof agent.send>[0],
    failureAnnouncement: string,
  ): Promise<boolean> {
    setSendError(null);
    const sent = await Result.tryPromise({
      try: () => agent.send(input),
      catch: cause => cause,
    });
    if (!Result.isError(sent)) return true;

    const message = eveErrorMessage(sent.error, failureAnnouncement);
    setSendError(message);
    setAnnouncement(message);
    return false;
  }

  function focusComposer() {
    inputRef.current?.focus();
  }

  function appendExample(example: string) {
    const current = form.state.values.message;
    const nextValue = current.trim() ? `${current}\n${example}` : example;
    form.setFieldValue("message", clampChatMessage(nextValue));
    inputRef.current?.focus();
  }

  async function submitMessage(messageValue: string) {
    const message = messageValue.trim();
    if (!message || isBusy) return;

    pendingComposerMessageRef.current = message;
    expectsAnalysisActionRef.current = true;
    receivedAnalysisActionRef.current = false;
    const isFirstMessage = persistence.beginFirstMessageSummaryIfNeeded(message, normalizeThreadSummary);
    // These updates are batched at the end of the submit event, before the
    // asynchronous send operation can update the agent status.
    setAnnouncement("相談内容を受け付け、分析を開始しています。");
    setIsSendStarting(true);
    const sent = await sendAgentInput(
      { message },
      "メッセージを送信できませんでした。再度お試しください。",
    );
    if (sent) {
      form.reset();
      if (isFirstMessage) persistence.commitFirstMessageSummary();
      return;
    }
    setIsSendStarting(false);
    if (isFirstMessage) persistence.rollbackFirstMessageSummary();
    form.setFieldValue("message", message);
    pendingComposerMessageRef.current = null;
    expectsAnalysisActionRef.current = false;
    receivedAnalysisActionRef.current = false;
  }

  function stopAgent() {
    setIsSendStarting(false);
    agent.stop();
  }

  async function respondToRequest(
    requestId: EveInputSelection["requestId"],
    optionId: EveInputSelection["optionId"],
  ) {
    await sendAgentInput(
      { inputResponses: [{ requestId, optionId }] },
      "選択内容を送信できませんでした。再度お試しください。",
    );
  }

  async function requestConsultation(expert: Expert) {
    await sendAgentInput(
      { message: `社員ID ${expert.id}（${expert.name}）への社内向け相談依頼文を作成してください。` },
      "相談依頼文を作成できませんでした。再度お試しください。",
    );
  }

  return (
    <WorkspaceShell currentThreadId={thread.id} threads={threads}>
      <div className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col p-[clamp(28px,5vw,64px)] max-sm:px-[18px] max-sm:py-7">
        <ChatHeader isBusy={isBusy} status={agent.status} title={thread.title} />
        <ConversationHistory
          canRespond={!isBusy}
          messages={agent.data.messages}
          onAnnounce={setAnnouncement}
          onFocusComposer={focusComposer}
          onRequestConsultation={requestConsultation}
          onRespond={respondToRequest}
        />
        {showImmediateLoading ? <ImmediateSendLoading /> : null}
        <ChatFeedback
          announcement={announcement}
          canRetrySave={persistence.canRetrySave}
          hasAgentError={Boolean(agent.error)}
          onRetrySave={persistence.retryStateSave}
          saveError={persistence.saveError}
          sendError={sendError}
        />
        <InputGuidance disabled={isBusy} onAppendExample={appendExample} />
        <ChatComposer
          form={form}
          inputRef={inputRef}
          isBusy={isBusy}
          onStop={stopAgent}
        />
      </div>
    </WorkspaceShell>
  );
}

function ImmediateSendLoading() {
  return (
    <div className="mx-auto my-3 grid w-full max-w-[780px] gap-2" role="status" aria-live="polite">
      <p className="m-0 text-[0.68rem] font-extrabold tracking-wider text-ink-soft">初動支援AI</p>
      <div className="flex items-center gap-3 rounded-[4px_16px_16px_16px] border border-[#a8cbc7] bg-teal-pale px-5 py-[18px] text-[0.86rem] font-bold text-[#176c67]">
        <span className="relative size-4 shrink-0" aria-hidden="true">
          <span className="absolute inset-0 rounded-full border-2 border-[#a8cbc7]" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-teal motion-reduce:animate-none" />
        </span>
        相談内容を受け付け、分析を開始しています…
      </div>
    </div>
  );
}

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

function ChatHeader({ isBusy, status, title }: {
  readonly isBusy: boolean;
  readonly status: AgentStatus;
  readonly title: ThreadSummary["title"];
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-8 border-b border-line bg-canvas/95 py-4 shadow-[0_10px_24px_rgb(16_38_59/5%)] backdrop-blur-md max-sm:items-start max-sm:gap-4 max-sm:py-3">
      <div>
        <p className={EYEBROW}>相談案件</p>
        <h1 className="max-w-[720px] font-display text-[clamp(1.35rem,3vw,2.1rem)] font-semibold tracking-[-0.04em]">
          <AccessibleTooltip className="block max-w-[min(720px,70vw)] [&>button]:block [&>button]:max-w-full [&>button>span]:block [&>button>span]:max-w-full [&>button>span]:overflow-hidden [&>button>span]:text-ellipsis [&>button>span]:underline [&>button>span]:decoration-dotted [&>button>span]:decoration-control-line [&>button>span]:underline-offset-[6px] [&>button>span]:whitespace-nowrap" content={title}>
            <span>{title}</span>
          </AccessibleTooltip>
        </h1>
      </div>
      <span className={cn("inline-flex min-h-[30px] items-center gap-[7px] rounded-full border border-[#a8cbc7] px-2.5 py-1 text-[0.7rem] font-extrabold text-[#176c67] before:size-[7px] before:rounded-full before:bg-teal before:content-['']", isBusy && "before:animate-status-pulse", status === "error" && "border-[#e1bebe] text-danger before:bg-danger")}>
        {isBusy ? "整理中" : status === "error" ? "エラー" : "待機中"}
      </span>
    </header>
  );
}

function ConversationHistory({
  canRespond,
  messages,
  onAnnounce,
  onFocusComposer,
  onRequestConsultation,
  onRespond,
}: {
  readonly canRespond: boolean;
  readonly messages: readonly EveMessage[];
  readonly onAnnounce: (message: string) => void;
  readonly onFocusComposer: () => void;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly onRespond: EveInputResponder;
}) {
  if (messages.length === 0) {
    return (
      <section className="m-auto grid max-w-[700px] grid-cols-[auto_1fr] items-start gap-6 px-6 py-16" aria-labelledby="empty-chat-heading">
        <span className="font-display text-[4rem] leading-none text-[#b7c7c3]">01</span>
        <div>
          <p className={EYEBROW}>相談受付準備完了</p>
          <h2 id="empty-chat-heading" className="m-0 font-display text-[1.65rem] font-semibold">相談内容を確認して送信してください</h2>
          <p className="leading-[1.8] text-ink-soft">AIが案件を構造化し、確認事項と根拠候補をまとめます。</p>
        </div>
      </section>
    );
  }

  return (
    <ol className="mx-auto my-9 grid w-full max-w-[780px] list-none gap-7 p-0" role="list">
      {messages.map((message, index) => (
        <ChatMessage
          key={message.id}
          message={message}
          canRespond={canRespond}
          isPending={!canRespond && index === messages.length - 1}
          onAnnounce={onAnnounce}
          onFocusComposer={onFocusComposer}
          onRequestConsultation={onRequestConsultation}
          onRespond={onRespond}
        />
      ))}
    </ol>
  );
}

function ChatFeedback({
  announcement,
  canRetrySave,
  hasAgentError,
  onRetrySave,
  saveError,
  sendError,
}: {
  readonly announcement: string;
  readonly canRetrySave: boolean;
  readonly hasAgentError: boolean;
  readonly onRetrySave: () => void;
  readonly saveError: string | null;
  readonly sendError: string | null;
}) {
  return (
    <>
      <p className="sr-only" aria-atomic="true" aria-live="polite">{announcement}</p>
      {hasAgentError || sendError ? (
        <p className="mx-auto my-2 w-full max-w-[780px] text-[0.82rem] font-bold text-danger" role="alert">
          {sendError ?? "処理に失敗しました。内容を確認して再度お試しください。"}
        </p>
      ) : null}
      {saveError ? (
        <div className="mx-auto my-2 flex w-full max-w-[780px] flex-wrap items-center justify-between gap-3">
          <p className="m-0 w-auto text-[0.82rem] font-bold text-danger" role="alert">{saveError}</p>
          {canRetrySave ? (
            <button className={`${SECONDARY_BUTTON} shrink-0`} type="button" onClick={onRetrySave}>
              保存を再試行
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function InputGuidance({ disabled, onAppendExample }: {
  readonly disabled: boolean;
  readonly onAppendExample: (example: string) => void;
}) {
  return (
    <section className="mx-auto my-3 mt-[26px] grid w-full max-w-[780px] grid-cols-[minmax(0,1fr)_minmax(250px,.8fr)] gap-5 rounded-[4px_14px_4px_4px] border border-control-line border-l-[5px] border-l-teal bg-[#f8fbfa] px-5 py-[18px] max-lg:grid-cols-1" aria-labelledby="input-guidance-title">
      <div>
        <p className={EYEBROW}>入力のヒント</p>
        <h2 id="input-guidance-title" className="m-0 font-display text-[1.08rem] leading-normal">分かる事実だけを、そのまま入力してください</h2>
        <p id="chat-input-hint" className="mt-2 mb-0 text-[0.76rem] leading-[1.7] text-ink-soft"><strong>AIへの命令文は不要です。</strong> 不明な項目は「不明」のままで構いません。</p>
        <ol className="mt-3.5 grid list-none grid-cols-2 gap-1.5 p-0" role="list">
          <li className="flex items-center gap-[7px] text-[0.72rem] font-bold"><span className="text-[0.64rem] font-black text-teal">01</span>物件の状態</li>
          <li className="flex items-center gap-[7px] text-[0.72rem] font-bold"><span className="text-[0.64rem] font-black text-teal">02</span>権利・関係者</li>
          <li className="flex items-center gap-[7px] text-[0.72rem] font-bold"><span className="text-[0.64rem] font-black text-teal">03</span>希望すること</li>
          <li className="flex items-center gap-[7px] text-[0.72rem] font-bold"><span className="text-[0.64rem] font-black text-teal">04</span>期限・安全上の懸念</li>
        </ol>
      </div>
      <div className="grid content-start gap-[7px]" aria-label="架空の追加情報例">
        <p className="mb-0.5 text-[0.68rem] font-extrabold text-ink-soft">例を入力欄へ追加</p>
        {INPUT_EXAMPLES.map(example => (
          <button className="min-h-10 cursor-pointer rounded-lg border border-control-line bg-paper px-2.5 py-[7px] text-left text-[0.7rem] leading-[1.45] font-bold text-navy hover:border-teal hover:bg-teal-pale disabled:cursor-not-allowed disabled:opacity-[.58]" key={example} type="button" disabled={disabled} onClick={() => onAppendExample(example)}>
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ChatComposer({ form, inputRef, isBusy, onStop }: {
  readonly form: ChatMessageForm;
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
  readonly isBusy: boolean;
  readonly onStop: () => void;
}) {
  return (
    <form className="sticky bottom-5 mx-auto mb-0 grid w-full max-w-[780px] rounded-[14px] border border-control-line bg-paper p-5 shadow-[0_18px_50px_rgb(16_38_59/7%)] focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgb(25_119_113/15%),0_18px_50px_rgb(16_38_59/7%)]" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void form.handleSubmit();
    }}>
      <form.AppForm>
      <label className="sr-only" htmlFor="chat-input">相談内容または追加情報</label>
      <form.AppField name="message">
        {field => (
          <textarea
            ref={inputRef}
            id="chat-input"
            rows={4}
            maxLength={MAX_CHAT_MESSAGE_CHARS}
            value={field.state.value}
            aria-describedby="chat-input-hint chat-privacy-reminder"
            disabled={isBusy}
            placeholder="相談内容、または追加で分かったことを入力…"
            className="w-full resize-y border-0 bg-transparent text-[0.94rem] leading-[1.85] text-ink outline-none"
            onBlur={field.handleBlur}
            onChange={event => field.handleChange(clampChatMessage(event.target.value))}
          />
        )}
      </form.AppField>
      <div className="flex items-center justify-between gap-5 border-t border-[#e7eceb] pt-3.5 max-sm:flex-col max-sm:items-stretch">
        <p id="chat-privacy-reminder" className="m-0 flex items-center gap-[7px] text-[0.72rem] text-[#75581d]"><span className="grid size-[18px] place-items-center rounded-full bg-amber-pale font-black" aria-hidden="true">!</span> 個人情報は入力しないでください</p>
        {isBusy ? (
          <button className={`${SECONDARY_BUTTON} max-sm:w-full`} type="button" onClick={onStop}>停止</button>
        ) : (
          <form.Subscribe selector={state => state.canSubmit && state.values.message.trim().length > 0}>
            {canSubmit => <button className={`${PRIMARY_BUTTON} max-sm:w-full`} type="submit" disabled={!canSubmit}>送信 <span aria-hidden="true">↑</span></button>}
          </form.Subscribe>
        )}
      </div>
      <p id="chat-ai-disclaimer" className="mt-3 mb-0 border-t border-[#e7eceb] pt-2.5 text-[0.7rem] leading-[1.7] text-ink-soft">
        AIは初動整理の参考情報を提示するものであり、法的・税務的判断、査定価格および契約可否の判断は行いません。最終判断は担当者または適切な専門家が行ってください。
      </p>
      </form.AppForm>
    </form>
  );
}

function ChatMessage({
  message,
  canRespond,
  isPending,
  onRespond,
  onRequestConsultation,
  onFocusComposer,
  onAnnounce,
}: {
  readonly message: EveMessage;
  readonly canRespond: boolean;
  readonly isPending: boolean;
  readonly onRespond: EveInputResponder;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly onFocusComposer: () => void;
  readonly onAnnounce: (message: string) => void;
}) {
  const hasVisibleContent = hasVisibleMessageContent(message);
  const analysis = findAnalysisOutput(message);
  const assistantText = message.role === "assistant"
    ? message.parts.reduce((text, part) => part.type === "text" ? `${text}${part.text}` : text, "")
    : "";
  const openUi = analysis ? extractOpenUiBlock(assistantText) : null;
  const hasRoot = openUi ? /^\s*root\s*=\s*Report\(/u.test(openUi.source) : false;
  const completedValidation = analysis && openUi?.closed && !isPending
    ? validateAnalysisGenUi(openUi.source, analysis)
    : null;
  const showGenUi = Boolean(analysis && openUi && hasRoot && (!completedValidation || completedValidation.ok));
  const showAnalysisSkeleton = Boolean(analysis && isPending && !showGenUi);

  return (
    <li className={cn("grid gap-2", message.role === "user" && "w-[min(620px,88%)] justify-self-end max-sm:w-[94%]")}>
      <p className={cn("m-0 text-[0.68rem] font-extrabold tracking-wider text-ink-soft", message.role === "user" && "text-right")}>{message.role === "user" ? "担当者" : "初動支援AI"}</p>
      <div className={cn("rounded-[4px_16px_16px_16px] border border-line bg-paper px-5 py-[18px] leading-[1.85] [&>p]:m-0 [&>p]:whitespace-pre-wrap", message.role === "user" && "rounded-[16px_4px_16px_16px] border-[#c5d8d5] bg-teal-pale")}>
        {message.role === "assistant" && isPending && !hasVisibleContent ? (
          <p className="flex items-center gap-3 text-[0.86rem] font-bold text-[#176c67]">
            <span className="relative size-4 shrink-0" aria-hidden="true">
              <span className="absolute inset-0 rounded-full border-2 border-[#a8cbc7]" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-teal motion-reduce:animate-none" />
            </span>
            相談内容を整理しています…
          </p>
        ) : null}
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            if (analysis) return null;
            return part.text.trim() ? <p key={`${message.id}:text:${index}`}>{part.text}</p> : null;
          }
          if (part.type === "dynamic-tool") {
            if (part.toolName === "analyze_case" && analysis) {
              if (showGenUi && openUi) {
                return <AnalysisGenUi
                  canRespond={canRespond}
                  isStreaming={isPending || !openUi.closed}
                  key={part.toolCallId}
                  onFocusComposer={onFocusComposer}
                  onRequestConsultation={onRequestConsultation}
                  output={analysis}
                  response={openUi.source}
                />;
              }
              if (showAnalysisSkeleton) return <AnalysisGenUiSkeleton key={part.toolCallId} />;
            }
            return <ToolResult key={part.toolCallId} part={part} canRespond={canRespond} onRespond={onRespond} onRequestConsultation={onRequestConsultation} onFocusComposer={onFocusComposer} onAnnounce={onAnnounce} />;
          }
          return null;
        })}
      </div>
    </li>
  );
}

function findAnalysisOutput(message: EveMessage): AnalyzeCaseOutput | null {
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool" || part.toolName !== "analyze_case" || part.state !== "output-available") continue;
    const parsed = AnalyzeCaseOutputSchema.safeParse(part.output);
    if (parsed.success) return parsed.data;
  }
  return null;
}

function hasVisibleMessageContent(message: EveMessage) {
  return message.parts.some(part => (
    (part.type === "text" && part.text.trim().length > 0)
    || part.type === "dynamic-tool"
  ));
}
