"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { anonymousAuth } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteDemoMutation = useMutation({
    mutationKey: ["auth", "delete-anonymous-user"],
    mutationFn: anonymousAuth.deleteAnonymousUser,
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries();
      router.replace("/");
      router.refresh();
    },
    retry: false,
    scope: { id: "auth-session" },
  });

  function deleteDemoData() {
    if (!window.confirm("アプリ内のデモデータを削除し、履歴へアクセスできなくします。Eve・LLM提供元での保持期間は各ポリシーに従います。元に戻せません。続行しますか？")) {
      return;
    }

    deleteDemoMutation.mutate();
  }

  return (
    <div className="relative">
      <details className="user-menu">
        <summary className="grid size-[38px] cursor-pointer place-items-center rounded-full bg-navy text-[0.62rem] font-extrabold text-white list-none [&::-webkit-details-marker]:hidden" aria-label="ユーザーメニューを開く">
          <span aria-hidden="true">匿名</span>
        </summary>
        <div className="absolute top-[46px] right-0 z-20 w-60 rounded-xl border border-line bg-white p-3.5 shadow-[0_18px_50px_rgb(16_38_59/16%)]">
          <p className="mb-3 grid gap-[3px] text-[0.78rem]"><strong>匿名デモ</strong><span className="text-[0.68rem] text-ink-soft">セッション有効期限：24時間</span></p>
          <button className="min-h-10 w-full cursor-pointer rounded-lg border border-[#e1bebe] bg-[#fff7f7] text-[0.75rem] font-extrabold text-danger disabled:cursor-wait disabled:opacity-[.62]" type="button" disabled={deleteDemoMutation.isPending} onClick={deleteDemoData}>
            {deleteDemoMutation.isPending ? "削除中…" : "デモデータを削除"}
          </button>
        </div>
      </details>
      {deleteDemoMutation.isError ? <p className="absolute top-12 right-[250px] w-60 bg-white p-2 text-[0.82rem] font-bold text-danger" role="alert">デモデータを削除できませんでした。</p> : null}
    </div>
  );
}
