import Link from "next/link";

export default function NotFound() {
  return (
    <main className="status-page">
      <section>
        <p className="eyebrow">404</p>
        <h1>ページが見つかりません</h1>
        <Link className="primary-button" href="/">
          トップへ戻る
        </Link>
      </section>
    </main>
  );
}
