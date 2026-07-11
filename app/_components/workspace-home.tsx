"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { SAMPLE_CASES } from "@/lib/sample-cases";
import type { ThreadRecord, ThreadSummary } from "@/shared/types/thread";
import { truncateThreadTitle } from "@/shared/types/thread";
import { WorkspaceShell } from "./workspace-shell";

export function WorkspaceHome({ threads }: { readonly threads: readonly ThreadSummary[] }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: truncateThreadTitle(message) }),
      });

      if (!response.ok) {
        setError("相談を開始できませんでした。再度お試しください。");
        return;
      }

      const payload = (await response.json()) as { thread: ThreadRecord };
      try {
        sessionStorage.setItem(`thread-draft:${payload.thread.id}`, message);
      }
      catch {
        setError("ブラウザの一時保存を利用できません。設定を確認してください。");
        return;
      }
      router.push(`/chat/${payload.thread.id}`);
    });
  }

  return (
    <WorkspaceShell threads={threads}>
      <div className="intake-workspace">
        <header className="intake-heading">
          <div>
            <p className="eyebrow">NEW INTAKE</p>
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
            <span>{draft.length.toLocaleString("ja-JP")} 文字</span>
          </div>
          <label className="visually-hidden" htmlFor="case-input">相談内容</label>
          <textarea
            ref={textareaRef}
            id="case-input"
            value={draft}
            rows={7}
            aria-describedby="privacy-reminder"
            aria-invalid={error ? true : undefined}
            placeholder="例：相続した空き家を兄弟で共有しています。一人と連絡が取れず、建物の老朽化も進んでいます…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="composer-footer">
            <p id="privacy-reminder"><span aria-hidden="true">!</span> 実在する氏名・住所・連絡先などは入力しないでください。</p>
            <button className="primary-button" type="button" disabled={isPending} onClick={submitCase}>
              {isPending ? "相談票を作成中…" : "この内容で相談を開始"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </section>
      </div>
    </WorkspaceShell>
  );
}
