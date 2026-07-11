"use client";

export default function ErrorPage({ reset }: { readonly reset: () => void }) {
  return (
    <main className="status-page">
      <section>
        <p className="eyebrow">エラー</p>
        <h1>画面を表示できませんでした</h1>
        <p>時間をおいて、もう一度お試しください。</p>
        <button className="primary-button" type="button" onClick={reset}>
          再試行
        </button>
      </section>
    </main>
  );
}
