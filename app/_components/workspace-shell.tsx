"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "cnfast";
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
    onError: () => setError("チャット履歴を削除できませんでした。"),
    onSuccess: async (_result, thread) => {
      queryClient.removeQueries({ exact: true, queryKey: threadQueryKeys.detail(thread.id) });
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
    <div className="grid h-dvh grid-cols-[280px_minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)] bg-canvas max-sm:grid-cols-1 max-sm:grid-rows-[60px_auto_minmax(0,1fr)]">
      <a className="fixed top-3 left-3 z-100 translate-y-[-160%] rounded-lg bg-navy-deep px-4 py-2.5 font-bold text-white no-underline focus:translate-y-0" href="#main-content">本文へ移動</a>
      <header className="z-5 col-span-full flex items-center justify-between border-b border-line bg-paper/96 px-5 max-sm:col-span-1 max-sm:px-3.5">
        <Link className="inline-flex items-center gap-[11px] font-extrabold tracking-[0.02em] no-underline" href="/" aria-label="初動支援AIの新規相談へ">
          <BrandMark />
          <span>初動支援AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex min-h-7 items-center rounded-full border border-[#a8cbc7] bg-teal-pale px-2.5 py-1 text-[0.72rem] font-extrabold tracking-wider text-[#105e59] max-sm:hidden">PoC / 架空データ</span>
          <UserMenu />
        </div>
      </header>

      <aside className="flex min-h-0 flex-col border-r border-line bg-[#edf3f1] px-3.5 py-[18px] max-sm:max-h-[210px] max-sm:border-r-0 max-sm:border-b">
        <Link className="flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-control-line bg-paper text-[0.86rem] font-extrabold text-navy no-underline hover:border-teal hover:bg-white" href="/">
          <span aria-hidden="true">＋</span> 新しい相談
        </Link>
        <nav className="mt-6 min-h-0 overflow-auto max-sm:mt-3" aria-label="チャット履歴">
          <div className="flex justify-between px-2 pb-[9px] text-[0.7rem] font-extrabold tracking-[0.08em] text-[#61766f]"><span>相談履歴</span><span>{threads.length}</span></div>
          {threads.length > 0 ? (
            <ul className="m-0 grid list-none gap-1 p-0">
              {threads.map((thread) => {
                const summary = thread.summary || "要約はありません";
                const shortSummary = normalizeThreadSummary(summary, 72);
                const isCurrent = thread.id === currentThreadId;
                return (
                  <li key={thread.id} className={cn("relative grid grid-cols-[minmax(0,1fr)_32px] items-center rounded-[9px] hover:bg-white/80", isCurrent && "bg-white/80 shadow-[inset_3px_0_#197771]")}>
                    <div className="min-w-0">
                      <Link className="grid min-w-0 gap-1 px-1 py-2.5 pl-3 no-underline" href={`/chat/${thread.id}`} aria-current={isCurrent ? "page" : undefined}>
                        <span className="overflow-hidden text-[0.78rem] font-bold text-ellipsis whitespace-nowrap">{thread.title}</span>
                        <time className="text-[0.66rem] text-[#6f817d]" dateTime={new Date(thread.updatedAt).toISOString()}>
                          {DATE_FORMATTER.format(new Date(thread.updatedAt))}
                        </time>
                      </Link>
                      <AccessibleTooltip className="my-[-5px] mb-[5px] flex [&>button]:block [&>button]:w-full [&>button]:px-3 [&>button]:pt-0.5 [&>button]:pb-[5px] [&>button]:text-left [&>button]:text-[0.68rem] [&>button]:leading-[1.45] [&>button]:text-[#536964] [&>button]:underline [&>button]:decoration-dotted [&>button]:decoration-control-line [&>button]:underline-offset-[3px] [&>button>span]:line-clamp-2" content={summary}>
                        <span>{shortSummary}</span>
                      </AccessibleTooltip>
                    </div>
                    <button className="size-7 cursor-pointer rounded-md border-0 bg-transparent text-[#677b76] hover:bg-[#f8e8e8] hover:text-danger disabled:cursor-wait disabled:opacity-[.62]" type="button" aria-label={`「${thread.title}」を削除`} disabled={deleteThreadMutation.isPending} onClick={() => deleteThread(thread)}>×</button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="m-2 text-[0.76rem] leading-[1.7] text-[#687b77]">相談を送信すると、ここに履歴が表示されます。</p>}
        </nav>
        {error ? <p className="text-[0.82rem] font-bold text-danger" role="alert">{error}</p> : null}
        <div className="mt-auto grid gap-1 rounded-[9px] border border-[#e4d3ad] bg-amber-pale p-[13px] text-[0.69rem] leading-[1.55] text-[#654c1d] max-sm:hidden">
          <strong>デモ利用上の注意</strong>
          <span>実在する個人情報を入力しないでください。</span>
        </div>
      </aside>
      <main id="main-content" className="min-h-0 min-w-0 overflow-auto" tabIndex={-1}>{children}</main>
    </div>
  );
}
