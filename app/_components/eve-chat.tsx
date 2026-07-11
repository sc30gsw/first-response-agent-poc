"use client";

import type { HandleMessageStreamEvent } from "eve/client";
import { useEveAgent, type EveDynamicToolPart, type EveMessage } from "eve/react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ThreadRecord, ThreadSummary } from "@/shared/types/thread";
import { WorkspaceShell } from "./workspace-shell";

const TOOL_LABELS: Record<string, string> = {
  analyze_case: "初動レポート",
  draft_consultation_request: "相談依頼文",
  search_experts: "有識者候補",
  search_guides: "社内初動ガイド",
  search_similar_cases: "類似事例",
};

type EveChatProps = {
  readonly thread: ThreadRecord;
  readonly threads: readonly ThreadSummary[];
};

export function EveChat({ thread, threads }: EveChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftStorageKey = useRef(`thread-draft:${thread.id}`).current;
  const [saveError, setSaveError] = useState<string | null>(null);
  const agent = useEveAgent({
    initialEvents: (thread.state?.events ?? []) as readonly HandleMessageStreamEvent[],
    initialSession: thread.state?.session,
    onFinish(snapshot) {
      void fetch(`/api/threads/${thread.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          state: {
            events: snapshot.events,
            session: snapshot.session,
          },
        }),
      }).then((response) => {
        if (!response.ok) setSaveError("会話履歴を保存できませんでした。");
      }).catch(() => setSaveError("会話履歴を保存できませんでした。"));
    },
  });
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(draftStorageKey);
      if (savedDraft && inputRef.current) {
        inputRef.current.value = savedDraft;
        sessionStorage.removeItem(draftStorageKey);
      }
    }
    catch {
      // The composer remains usable when session storage is unavailable.
    }
  }, [draftStorageKey]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = inputRef.current?.value.trim() ?? "";
    if (!message || isBusy) return;

    if (inputRef.current) inputRef.current.value = "";
    await agent.send({ message });
  }

  return (
    <WorkspaceShell currentThreadId={thread.id} threads={threads}>
      <div className="chat-workspace">
        <header className="chat-header">
          <div>
            <p className="eyebrow">CASE FILE</p>
            <h1>{thread.title}</h1>
          </div>
          <span className={`agent-status agent-status--${agent.status}`}>
            {isBusy ? "整理中" : agent.status === "error" ? "エラー" : "待機中"}
          </span>
        </header>

        {agent.data.messages.length > 0 ? (
          <ol className="message-log" role="log" aria-live="polite" aria-relevant="additions text">
            {agent.data.messages.map((message) => (
              <ChatMessage key={message.id} message={message} canRespond={!isBusy} onRespond={(requestId, optionId) => agent.send({ inputResponses: [{ requestId, optionId }] })} />
            ))}
          </ol>
        ) : (
          <section className="empty-chat" aria-labelledby="empty-chat-heading">
            <span className="empty-chat-index">01</span>
            <div>
              <p className="eyebrow">READY FOR INTAKE</p>
              <h2 id="empty-chat-heading">相談内容を確認して送信してください</h2>
              <p>AIが案件を構造化し、確認事項と根拠候補をまとめます。</p>
            </div>
          </section>
        )}

        {agent.error ? <p className="form-error chat-error" role="alert">処理に失敗しました。内容を確認して再度お試しください。</p> : null}
        {saveError ? <p className="form-error chat-error" role="alert">{saveError}</p> : null}

        <form className="chat-composer" onSubmit={submitMessage}>
          <label className="visually-hidden" htmlFor="chat-input">相談内容または追加情報</label>
          <textarea
            ref={inputRef}
            id="chat-input"
            rows={4}
            disabled={isBusy}
            placeholder="相談内容、または追加で分かったことを入力…"
          />
          <div className="chat-composer-footer">
            <p><span aria-hidden="true">!</span> 個人情報は入力しないでください</p>
            {isBusy ? (
              <button className="secondary-button" type="button" onClick={agent.stop}>停止</button>
            ) : (
              <button className="primary-button" type="submit">送信 <span aria-hidden="true">↑</span></button>
            )}
          </div>
        </form>
      </div>
    </WorkspaceShell>
  );
}

function ChatMessage({
  message,
  canRespond,
  onRespond,
}: {
  readonly message: EveMessage;
  readonly canRespond: boolean;
  readonly onRespond: (requestId: string, optionId: string) => Promise<void>;
}) {
  return (
    <li className={`chat-message chat-message--${message.role}`}>
      <p className="message-author">{message.role === "user" ? "担当者" : "初動支援AI"}</p>
      <div className="message-body">
        {message.parts.map((part, index) => {
          if (part.type === "text") return <p key={`${message.id}:text:${index}`}>{part.text}</p>;
          if (part.type === "dynamic-tool") {
            return <ToolProgress key={part.toolCallId} part={part} canRespond={canRespond} onRespond={onRespond} />;
          }
          return null;
        })}
      </div>
    </li>
  );
}

function ToolProgress({
  part,
  canRespond,
  onRespond,
}: {
  readonly part: EveDynamicToolPart;
  readonly canRespond: boolean;
  readonly onRespond: (requestId: string, optionId: string) => Promise<void>;
}) {
  const request = part.toolMetadata?.eve?.inputRequest;
  const isComplete = part.state === "output-available";

  return (
    <section className="tool-progress">
      <div>
        <span className={isComplete ? "tool-dot tool-dot--complete" : "tool-dot"} aria-hidden="true" />
        <strong>{TOOL_LABELS[part.toolName] ?? "案件情報を確認中"}</strong>
      </div>
      <span>{isComplete ? "完了" : part.state === "output-error" ? "失敗" : "処理中"}</span>
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
