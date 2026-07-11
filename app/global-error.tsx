"use client";

export default function GlobalError({ reset }: { readonly reset: () => void }) {
  return (
    <html lang="ja">
      <body>
        <main className="status-page">
          <section>
            <h1>予期しないエラーが発生しました</h1>
            <button className="primary-button" type="button" onClick={reset}>
              再試行
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
