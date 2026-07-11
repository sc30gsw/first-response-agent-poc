"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { threadApiClient } from "@/lib/api-client";
import { threadQueryKeys } from "@/lib/query-keys";
import { SAMPLE_CASES } from "@/lib/sample-cases";
import { MAX_CHAT_MESSAGE_CHARS } from "@/shared/chat-limits";
import type { ThreadSummary } from "@/shared/types/thread";
import {
  normalizeThreadSummary,
  truncateThreadTitle,
} from "@/shared/types/thread";
import { WorkspaceShell } from "./workspace-shell";

export function WorkspaceHome({ threads }: { readonly threads: readonly ThreadSummary[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createThread = useMutation({
    mutationKey: ["threads", "create"],
    mutationFn: (message: string) => threadApiClient.create({
      summary: normalizeThreadSummary(message),
      title: truncateThreadTitle(message),
    }),
    onError: () => {
      setError("相談を開始できませんでした。再度お試しください。");
    },
    onSuccess: async (thread, message) => {
      queryClient.setQueryData(threadQueryKeys.detail(thread.id), thread);
      await queryClient.invalidateQueries({ queryKey: threadQueryKeys.lists() });
      const stored = Result.try({
        try: () => sessionStorage.setItem(`thread-draft:${thread.id}`, message),
        catch: cause => cause,
      });
      if (Result.isError(stored)) {
        setError("ブラウザの一時保存を利用できません。設定を確認してください。");
        return;
      }

      router.push(`/chat/${thread.id}`);
    },
    retry: false,
    scope: { id: "thread-create" },
  });

  function chooseSample(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  function submitCase() {
    const message = draft.trim();
    if (!message) {
      setError("相談内容を入力してください。");
      textareaRef.current?.focus();
      return;
    }

    setError(null);
    createThread.mutate(message);
  }

  return (
    <WorkspaceShell threads={threads}>
      <div className="intake-workspace">
        <header className="intake-heading">
          <div>
            <p className="eyebrow">新規相談</p>
            <h1>相談内容を整理する</h1>
          </div>
          <p>サンプルを選ぶか、相談内容を自由に入力してください。</p>
        </header>

        <section className="sample-section" aria-labelledby="sample-heading">
          <div className="section-heading">
            <h2 id="sample-heading">サンプル案件</h2>
            <span>すべて架空の内容です</span>
          </div>
          <div className="sample-grid">
            {SAMPLE_CASES.map((sample) => (
              <button key={sample.id} className={`sample-card sample-card--${sample.id}`} type="button" onClick={() => chooseSample(sample.prompt)}>
                <span className="sample-code">{sample.code}</span>
                <strong>{sample.label}</strong>
                <span>{sample.summary}</span>
                <span className="sample-action">入力欄に反映 <span aria-hidden="true">↘</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className="composer-card" aria-labelledby="composer-heading">
          <div className="section-heading">
            <h2 id="composer-heading">相談内容</h2>
            <span>{draft.length.toLocaleString("ja-JP")} / {MAX_CHAT_MESSAGE_CHARS.toLocaleString("ja-JP")} 文字</span>
          </div>
          <label className="visually-hidden" htmlFor="case-input">相談内容</label>
          <textarea
            ref={textareaRef}
            id="case-input"
            value={draft}
            rows={7}
            maxLength={MAX_CHAT_MESSAGE_CHARS}
            aria-describedby="privacy-reminder"
            aria-invalid={error ? true : undefined}
            placeholder="例：相続した空き家を兄弟で共有しています。一人と連絡が取れず、建物の老朽化も進んでいます…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="composer-footer">
            <p id="privacy-reminder"><span aria-hidden="true">!</span> 実在する氏名・住所・連絡先などは入力しないでください。</p>
            <button className="primary-button" type="button" disabled={createThread.isPending} onClick={submitCase}>
              {createThread.isPending ? "相談票を作成中…" : "この内容で相談を開始"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </section>
      </div>
    </WorkspaceShell>
  );
}
