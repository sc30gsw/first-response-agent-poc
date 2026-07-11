"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import type { ThreadSummary } from "@/shared/types/thread";
import { BrandMark } from "./brand-mark";
import { UserMenu } from "./user-menu";

type WorkspaceShellProps = {
  readonly children: ReactNode;
  readonly currentThreadId?: string;
  readonly threads: readonly ThreadSummary[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

export function WorkspaceShell({ children, currentThreadId, threads }: WorkspaceShellProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function deleteThread(thread: ThreadSummary) {
    if (!window.confirm(`「${thread.title}」を削除しますか？`)) return;

    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/threads/${thread.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("チャット履歴を削除できませんでした。");
        return;
      }

      if (thread.id === currentThreadId) router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">本文へ移動</a>
      <header className="workspace-header">
        <Link className="product-lockup" href="/" aria-label="初動支援AIの新規相談へ">
          <BrandMark />
          <span>初動支援AI</span>
        </Link>
        <div className="workspace-meta">
          <span className="poc-chip">PoC / 架空データ</span>
          <UserMenu />
        </div>
      </header>

      <aside className="history-panel">
        <Link className="new-thread-button" href="/">
          <span aria-hidden="true">＋</span> 新しい相談
        </Link>
        <nav aria-label="チャット履歴">
          <div className="panel-label"><span>相談履歴</span><span>{threads.length}</span></div>
          {threads.length > 0 ? (
            <ul className="thread-list">
              {threads.map((thread) => (
                <li key={thread.id} className={thread.id === currentThreadId ? "is-current" : undefined}>
                  <Link href={`/chat/${thread.id}`} aria-current={thread.id === currentThreadId ? "page" : undefined}>
                    <span>{thread.title}</span>
                    <time dateTime={new Date(thread.updatedAt).toISOString()}>
                      {DATE_FORMATTER.format(new Date(thread.updatedAt))}
                    </time>
                  </Link>
                  <button
                    type="button"
                    aria-label={`「${thread.title}」を削除`}
                    disabled={isPending}
                    onClick={() => deleteThread(thread)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-history">相談を送信すると、ここに履歴が表示されます。</p>
          )}
        </nav>
        {error ? <p className="sidebar-error" role="alert">{error}</p> : null}
        <div className="sidebar-note">
          <strong>デモ利用上の注意</strong>
          <span>実在する個人情報を入力しないでください。</span>
        </div>
      </aside>

      <main id="main-content" className="workspace-main">{children}</main>
    </div>
  );
}
