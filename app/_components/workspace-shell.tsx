"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { threadApiClient } from "@/lib/api-client";
import { threadQueryKeys } from "@/lib/query-keys";
import type { ThreadSummary } from "@/shared/types/thread";
import { normalizeThreadSummary } from "@/shared/types/thread";
import { AccessibleTooltip } from "./accessible-tooltip";
import { BrandMark } from "./brand-mark";
import { UserMenu } from "./user-menu";

type WorkspaceShellProps = {
  readonly children: ReactNode;
  readonly currentThreadId?: ThreadSummary["id"];
  readonly threads: readonly ThreadSummary[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

export function WorkspaceShell({ children, currentThreadId, threads }: WorkspaceShellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const deleteThreadMutation = useMutation({
    mutationKey: ["threads", "delete"],
    mutationFn: (thread: ThreadSummary) => threadApiClient.delete(thread.id),
    onError: () => {
      setError("チャット履歴を削除できませんでした。");
    },
    onSuccess: async (_result, thread) => {
      queryClient.removeQueries({
        exact: true,
        queryKey: threadQueryKeys.detail(thread.id),
      });
      queryClient.setQueriesData<ThreadSummary[]>(
        { queryKey: threadQueryKeys.lists() },
        cached => cached?.filter(item => item.id !== thread.id),
      );
      await queryClient.invalidateQueries({ queryKey: threadQueryKeys.lists() });
      if (thread.id === currentThreadId) router.replace("/");
      router.refresh();
    },
    retry: false,
    scope: { id: "thread-delete" },
  });

  function deleteThread(thread: ThreadSummary) {
    if (!window.confirm(`「${thread.title}」を削除しますか？`)) return;

    setError(null);
    deleteThreadMutation.mutate(thread);
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
              {threads.map((thread) => {
                const summary = thread.summary || "要約はありません";
                const shortSummary = normalizeThreadSummary(summary, 72);
                return (
                  <li key={thread.id} className={thread.id === currentThreadId ? "is-current" : undefined}>
                    <div className="thread-entry">
                      <Link href={`/chat/${thread.id}`} aria-current={thread.id === currentThreadId ? "page" : undefined}>
                        <span className="thread-title">{thread.title}</span>
                        <time dateTime={new Date(thread.updatedAt).toISOString()}>
                          {DATE_FORMATTER.format(new Date(thread.updatedAt))}
                        </time>
                      </Link>
                      <AccessibleTooltip className="thread-summary-tooltip" content={summary}>
                        <span>{shortSummary}</span>
                      </AccessibleTooltip>
                    </div>
                    <button
                      type="button"
                      aria-label={`「${thread.title}」を削除`}
                      disabled={deleteThreadMutation.isPending}
                      onClick={() => deleteThread(thread)}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
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

      <main id="main-content" className="workspace-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
