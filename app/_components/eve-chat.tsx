"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useEveAgent, type EveMessage } from "eve/react";
import { useEffect, useRef, useState } from "react";
import type { RefObject, SubmitEvent } from "react";
import { cn } from "cnfast";
import {
  shouldRetryThreadApiError,
  threadApiClient,
  threadApiRetryDelay,
  ThreadApiClientError,
} from "@/lib/api-client";
import { threadQueryKeys } from "@/lib/query-keys";
import { MAX_CHAT_MESSAGE_CHARS } from "@/shared/chat-limits";
import {
  PersistedEveEventSchema,
  PersistedEveEventsSchema,
  type EveInputResponder,
  type EveInputSelection,
} from "@/shared/eve-events";
import {
  threadRecordToSummary,
  type ThreadRecord,
  type ThreadState,
  type ThreadSummary,
} from "@/shared/types/thread";
import type { Expert } from "@/shared/tools/first-response";
import { AccessibleTooltip } from "./accessible-tooltip";
import { ToolResult } from "./tool-results";
import { WorkspaceShell } from "./workspace-shell";

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

export function EveChat({ thread, threads }: EveChatProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftStorageKey = useRef(`thread-draft:${thread.id}`).current;
  const eventsRef = useRef<ThreadState["events"]>(thread.state?.events ?? []);
  const sessionRef = useRef<ThreadState["session"]>(thread.state?.session ?? { streamIndex: 0 });
  const revisionRef = useRef(thread.revision);
  const pendingSaveRef = useRef<ThreadState | null>(null);
  const saveWorkerRef = useRef<Promise<void> | null>(null);
  const saveBlockedRef = useRef(false);
  const savePausedRef = useRef(false);
  const manualSaveRetryRef = useRef(false);
  const pendingComposerMessageRef = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [canRetrySave, setCanRetrySave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const saveThreadMutation = useMutation({
    mutationKey: ["threads", thread.id, "state"],
    mutationFn: async (state: ThreadState) => {
      const expectedRevision = revisionRef.current;
      const updatedThread = await threadApiClient.update({
        expectedRevision,
        id: thread.id,
        input: { state },
      });
      if (updatedThread.revision !== expectedRevision + 1) {
        throw new ThreadApiClientError({
          code: "invalid_response",
          message: "API returned an unexpected revision",
          retryable: false,
          status: 200,
        });
      }
      return updatedThread;
    },
    onError: (error) => {
      if (error instanceof ThreadApiClientError && error.code === "conflict") {
        saveBlockedRef.current = true;
        savePausedRef.current = false;
        manualSaveRetryRef.current = false;
        pendingSaveRef.current = null;
        setCanRetrySave(false);
        setSaveError("別の画面で会話履歴が更新されました。最新の履歴を保つため、このページを再読み込みしてください。");
        return;
      }
      if (error instanceof ThreadApiClientError && error.code === "invalid_response") {
        setSaveError("会話履歴の保存結果を確認できませんでした。再試行し、解消しない場合はページを再読み込みしてください。");
        return;
      }
      if (error instanceof ThreadApiClientError && error.code === "network_error") {
        setSaveError("通信エラーにより会話履歴を保存できませんでした。接続を確認してください。");
        return;
      }
      setSaveError("会話履歴を保存できませんでした。ページを閉じずに再度お試しください。");
    },
    onSuccess: (updatedThread) => {
      const summary = threadRecordToSummary(updatedThread);
      revisionRef.current = updatedThread.revision;
      queryClient.setQueryData(threadQueryKeys.detail(thread.id), updatedThread);
      queryClient.setQueriesData<ThreadSummary[]>(
        { queryKey: threadQueryKeys.lists() },
        cached => cached?.map(item => item.id === summary.id ? summary : item),
      );
      savePausedRef.current = false;
      setCanRetrySave(false);
      if (!saveBlockedRef.current) setSaveError(null);
      if (manualSaveRetryRef.current) {
        manualSaveRetryRef.current = false;
        setAnnouncement("会話履歴を保存しました。");
      }
    },
    retry: shouldRetryThreadApiError,
    retryDelay: threadApiRetryDelay,
    scope: { id: `thread-state:${thread.id}` },
  });

  function currentThreadState(): ThreadState {
    return {
      events: [...eventsRef.current],
      session: { ...sessionRef.current },
    };
  }

  function enqueueStateSave(state: ThreadState) {
    if (saveBlockedRef.current) return;
    pendingSaveRef.current = state;
    if (savePausedRef.current || saveWorkerRef.current) return;

    const worker = (async () => {
      while (pendingSaveRef.current && !saveBlockedRef.current) {
        const nextState = pendingSaveRef.current;
        pendingSaveRef.current = null;
        const saved = await Result.tryPromise({
          try: () => saveThreadMutation.mutateAsync(nextState),
          catch: cause => cause,
        });
        if (Result.isError(saved)) {
          if (!saveBlockedRef.current) {
            pendingSaveRef.current ??= nextState;
            savePausedRef.current = true;
            manualSaveRetryRef.current = false;
            setCanRetrySave(true);
            setAnnouncement("会話履歴を保存できませんでした。保存を再試行できます。");
          }
          break;
        }
      }
    })();

    saveWorkerRef.current = worker;
    void worker.finally(() => {
      if (saveWorkerRef.current === worker) saveWorkerRef.current = null;
      if (pendingSaveRef.current && !saveBlockedRef.current && !savePausedRef.current) {
        enqueueStateSave(pendingSaveRef.current);
      }
    });
  }

  function retryStateSave() {
    const pendingState = pendingSaveRef.current;
    if (!pendingState || saveBlockedRef.current || !savePausedRef.current || saveWorkerRef.current) return;

    savePausedRef.current = false;
    manualSaveRetryRef.current = true;
    setCanRetrySave(false);
    setAnnouncement("会話履歴の保存を再試行しています。");
    enqueueStateSave(pendingState);
  }

  const agent = useEveAgent({
    headers: { "x-thread-id": thread.id },
    initialEvents: thread.state?.events,
    initialSession: thread.state?.session,
    onError() {
      const pendingMessage = pendingComposerMessageRef.current;
      if (pendingMessage && inputRef.current) inputRef.current.value = pendingMessage;
      setSendError("処理に失敗しました。入力内容を確認して再度お試しください。");
      setAnnouncement("処理に失敗しました。入力内容を確認して再度お試しください。");
    },
    onEvent(event) {
      const parsed = PersistedEveEventSchema.safeParse(event);
      if (!parsed.success) {
        saveBlockedRef.current = true;
        savePausedRef.current = false;
        manualSaveRetryRef.current = false;
        pendingSaveRef.current = null;
        setCanRetrySave(false);
        setSaveError("未対応の会話イベントを受信したため、履歴の保存を停止しました。ページを再読み込みしてください。");
        return;
      }

      eventsRef.current = [...eventsRef.current, parsed.data];
      enqueueStateSave(currentThreadState());
    },
    onSessionChange(session) {
      sessionRef.current = { ...session };
      enqueueStateSave(currentThreadState());
    },
    onFinish(snapshot) {
      if (!snapshot.error) {
        pendingComposerMessageRef.current = null;
        setSendError(null);
      }
      const parsedEvents = PersistedEveEventsSchema.safeParse(snapshot.events);
      if (parsedEvents.success) {
        eventsRef.current = parsedEvents.data;
        sessionRef.current = { ...snapshot.session };
        enqueueStateSave(currentThreadState());
      }

      const boundary = snapshot.events.at(-1)?.type;
      if (!snapshot.error && (boundary === "session.waiting" || boundary === "session.completed")) {
        setAnnouncement("初動支援AIの回答が完了しました。");
      }
    },
  });
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  useEffect(() => {
    const restored = Result.try({
      try: () => {
        const savedDraft = sessionStorage.getItem(draftStorageKey);
        if (savedDraft) sessionStorage.removeItem(draftStorageKey);
        return savedDraft;
      },
      catch: cause => cause,
    });
    if (!Result.isError(restored) && restored.value && inputRef.current) {
      inputRef.current.value = restored.value;
    }
  }, [draftStorageKey]);

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

    setSendError(failureAnnouncement);
    setAnnouncement(failureAnnouncement);
    return false;
  }

  function focusComposer() {
    inputRef.current?.focus();
  }

  function appendExample(example: string) {
    const input = inputRef.current;
    if (!input) return;
    const current = input.value.trim();
    const nextValue = current ? `${current}\n${example}` : example;
    input.value = nextValue.slice(0, MAX_CHAT_MESSAGE_CHARS);
    input.focus();
  }

  async function submitMessage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = inputRef.current?.value.trim() ?? "";
    if (!message || isBusy) return;

    setAnnouncement("");
    pendingComposerMessageRef.current = message;
    if (inputRef.current) inputRef.current.value = "";
    const sent = await sendAgentInput(
      { message },
      "メッセージを送信できませんでした。再度お試しください。",
    );
    if (!sent && inputRef.current) {
      inputRef.current.value = message;
      pendingComposerMessageRef.current = null;
    }
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
        <ChatFeedback
          announcement={announcement}
          canRetrySave={canRetrySave}
          hasAgentError={Boolean(agent.error)}
          onRetrySave={retryStateSave}
          saveError={saveError}
          sendError={sendError}
        />
        <InputGuidance disabled={isBusy} onAppendExample={appendExample} />
        <ChatComposer
          inputRef={inputRef}
          isBusy={isBusy}
          onStop={agent.stop}
          onSubmit={submitMessage}
        />
      </div>
    </WorkspaceShell>
  );
}

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

function ChatHeader({ isBusy, status, title }: {
  readonly isBusy: boolean;
  readonly status: AgentStatus;
  readonly title: ThreadSummary["title"];
}) {
  return (
    <header className="flex items-center justify-between gap-8 border-b border-line pb-7 max-sm:items-start">
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
      {messages.map(message => (
        <ChatMessage
          key={message.id}
          message={message}
          canRespond={canRespond}
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

function ChatComposer({ inputRef, isBusy, onStop, onSubmit }: {
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
  readonly isBusy: boolean;
  readonly onStop: () => void;
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form className="sticky bottom-5 mx-auto mb-0 grid w-full max-w-[780px] rounded-[14px] border border-control-line bg-paper p-5 shadow-[0_18px_50px_rgb(16_38_59/7%)] focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgb(25_119_113/15%),0_18px_50px_rgb(16_38_59/7%)]" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="chat-input">相談内容または追加情報</label>
      <textarea
        ref={inputRef}
        id="chat-input"
        rows={4}
        maxLength={MAX_CHAT_MESSAGE_CHARS}
        aria-describedby="chat-input-hint chat-privacy-reminder"
        disabled={isBusy}
        placeholder="相談内容、または追加で分かったことを入力…"
        className="w-full resize-y border-0 bg-transparent text-[0.94rem] leading-[1.85] text-ink outline-none"
      />
      <div className="flex items-center justify-between gap-5 border-t border-[#e7eceb] pt-3.5 max-sm:flex-col max-sm:items-stretch">
        <p id="chat-privacy-reminder" className="m-0 flex items-center gap-[7px] text-[0.72rem] text-[#75581d]"><span className="grid size-[18px] place-items-center rounded-full bg-amber-pale font-black" aria-hidden="true">!</span> 個人情報は入力しないでください</p>
        {isBusy ? (
          <button className={`${SECONDARY_BUTTON} max-sm:w-full`} type="button" onClick={onStop}>停止</button>
        ) : (
          <button className={`${PRIMARY_BUTTON} max-sm:w-full`} type="submit">送信 <span aria-hidden="true">↑</span></button>
        )}
      </div>
      <p id="chat-ai-disclaimer" className="mt-3 mb-0 border-t border-[#e7eceb] pt-2.5 text-[0.7rem] leading-[1.7] text-ink-soft">
        AIは初動整理の参考情報を提示するものであり、法的・税務的判断、査定価格および契約可否の判断は行いません。最終判断は担当者または適切な専門家が行ってください。
      </p>
    </form>
  );
}

function ChatMessage({
  message,
  canRespond,
  onRespond,
  onRequestConsultation,
  onFocusComposer,
  onAnnounce,
}: {
  readonly message: EveMessage;
  readonly canRespond: boolean;
  readonly onRespond: EveInputResponder;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly onFocusComposer: () => void;
  readonly onAnnounce: (message: string) => void;
}) {
  return (
    <li className={cn("grid gap-2", message.role === "user" && "w-[min(620px,88%)] justify-self-end max-sm:w-[94%]")}>
      <p className={cn("m-0 text-[0.68rem] font-extrabold tracking-wider text-ink-soft", message.role === "user" && "text-right")}>{message.role === "user" ? "担当者" : "初動支援AI"}</p>
      <div className={cn("rounded-[4px_16px_16px_16px] border border-line bg-paper px-5 py-[18px] leading-[1.85] [&>p]:m-0 [&>p]:whitespace-pre-wrap", message.role === "user" && "rounded-[16px_4px_16px_16px] border-[#c5d8d5] bg-teal-pale")}>
        {message.parts.map((part, index) => {
          if (part.type === "text") return <p key={`${message.id}:text:${index}`}>{part.text}</p>;
          if (part.type === "dynamic-tool") {
            return <ToolResult key={part.toolCallId} part={part} canRespond={canRespond} onRespond={onRespond} onRequestConsultation={onRequestConsultation} onFocusComposer={onFocusComposer} onAnnounce={onAnnounce} />;
          }
          return null;
        })}
      </div>
    </li>
  );
}
