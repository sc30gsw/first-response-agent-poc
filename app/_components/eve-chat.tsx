"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useEveAgent, type EveMessage } from "eve/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
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
} from "@/shared/eve-events";
import type { ThreadRecord, ThreadState, ThreadSummary } from "@/shared/types/thread";
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
      const summary: ThreadSummary = {
        createdAt: updatedThread.createdAt,
        id: updatedThread.id,
        revision: updatedThread.revision,
        summary: updatedThread.summary,
        title: updatedThread.title,
        updatedAt: updatedThread.updatedAt,
      };
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

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
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

  async function respondToRequest(requestId: string, optionId: string) {
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
      <div className="chat-workspace">
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
  readonly title: string;
}) {
  return (
    <header className="chat-header">
      <div>
        <p className="eyebrow">相談案件</p>
        <h1>
          <AccessibleTooltip className="case-title-tooltip" content={title}>
            <span>{title}</span>
          </AccessibleTooltip>
        </h1>
      </div>
      <span className={`agent-status agent-status--${status}`}>
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
  readonly onRespond: (requestId: string, optionId: string) => Promise<void>;
}) {
  if (messages.length === 0) {
    return (
      <section className="empty-chat" aria-labelledby="empty-chat-heading">
        <span className="empty-chat-index">01</span>
        <div>
          <p className="eyebrow">相談受付準備完了</p>
          <h2 id="empty-chat-heading">相談内容を確認して送信してください</h2>
          <p>AIが案件を構造化し、確認事項と根拠候補をまとめます。</p>
        </div>
      </section>
    );
  }

  return (
    <ol className="message-log" role="list">
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
      <p className="visually-hidden" aria-atomic="true" aria-live="polite">{announcement}</p>
      {hasAgentError || sendError ? (
        <p className="form-error chat-error" role="alert">
          {sendError ?? "処理に失敗しました。内容を確認して再度お試しください。"}
        </p>
      ) : null}
      {saveError ? (
        <div className="chat-save-feedback">
          <p className="form-error chat-error" role="alert">{saveError}</p>
          {canRetrySave ? (
            <button className="secondary-button" type="button" onClick={onRetrySave}>
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
    <section className="input-guidance" aria-labelledby="input-guidance-title">
      <div className="input-guidance-copy">
        <p className="eyebrow">入力のヒント</p>
        <h2 id="input-guidance-title">分かる事実だけを、そのまま入力してください</h2>
        <p id="chat-input-hint"><strong>AIへの命令文は不要です。</strong> 不明な項目は「不明」のままで構いません。</p>
        <ol role="list">
          <li><span>01</span>物件の状態</li>
          <li><span>02</span>権利・関係者</li>
          <li><span>03</span>希望すること</li>
          <li><span>04</span>期限・安全上の懸念</li>
        </ol>
      </div>
      <div className="input-examples" aria-label="架空の追加情報例">
        <p>例を入力欄へ追加</p>
        {INPUT_EXAMPLES.map(example => (
          <button key={example} type="button" disabled={disabled} onClick={() => onAppendExample(example)}>
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
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      <label className="visually-hidden" htmlFor="chat-input">相談内容または追加情報</label>
      <textarea
        ref={inputRef}
        id="chat-input"
        rows={4}
        maxLength={MAX_CHAT_MESSAGE_CHARS}
        aria-describedby="chat-input-hint chat-privacy-reminder"
        disabled={isBusy}
        placeholder="相談内容、または追加で分かったことを入力…"
      />
      <div className="chat-composer-footer">
        <p id="chat-privacy-reminder"><span aria-hidden="true">!</span> 個人情報は入力しないでください</p>
        {isBusy ? (
          <button className="secondary-button" type="button" onClick={onStop}>停止</button>
        ) : (
          <button className="primary-button" type="submit">送信 <span aria-hidden="true">↑</span></button>
        )}
      </div>
      <p id="chat-ai-disclaimer" className="ai-disclaimer">
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
  readonly onRespond: (requestId: string, optionId: string) => Promise<void>;
  readonly onRequestConsultation: (expert: Expert) => Promise<void>;
  readonly onFocusComposer: () => void;
  readonly onAnnounce: (message: string) => void;
}) {
  return (
    <li className={`chat-message chat-message--${message.role}`}>
      <p className="message-author">{message.role === "user" ? "担当者" : "初動支援AI"}</p>
      <div className="message-body">
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
