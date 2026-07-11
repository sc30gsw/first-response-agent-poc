"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export function UserMenu() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function deleteDemoData() {
    if (!window.confirm("匿名ユーザー、セッション、すべてのチャット履歴を削除します。元に戻せません。続行しますか？")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await authClient.deleteAnonymousUser();
      if (result.error) {
        setError("デモデータを削除できませんでした。");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="user-menu-wrap">
      <details className="user-menu">
        <summary aria-label="ユーザーメニューを開く">
          <span aria-hidden="true">匿名</span>
        </summary>
        <div className="user-menu-panel">
          <p><strong>匿名デモ</strong><span>保存期間：24時間</span></p>
          <button type="button" disabled={isPending} onClick={deleteDemoData}>
            {isPending ? "削除中…" : "デモデータを削除"}
          </button>
        </div>
      </details>
      {error ? <p className="menu-error" role="alert">{error}</p> : null}
    </div>
  );
}
