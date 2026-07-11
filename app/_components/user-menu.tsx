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
    <div className="user-menu-wrap">
      <details className="user-menu">
        <summary aria-label="ユーザーメニューを開く">
          <span aria-hidden="true">匿名</span>
        </summary>
        <div className="user-menu-panel">
          <p><strong>匿名デモ</strong><span>セッション有効期限：24時間</span></p>
          <button type="button" disabled={deleteDemoMutation.isPending} onClick={deleteDemoData}>
            {deleteDemoMutation.isPending ? "削除中…" : "デモデータを削除"}
          </button>
        </div>
      </details>
      {deleteDemoMutation.isError ? <p className="menu-error" role="alert">デモデータを削除できませんでした。</p> : null}
    </div>
  );
}
