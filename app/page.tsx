export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-card" aria-labelledby="page-title">
        <p className="eyebrow">検証用デモ</p>
        <h1 id="page-title">複雑な相談の初動を、整理しやすく。</h1>
        <p className="lead">
          相談内容から確認事項、類似事例、社内ガイド、相談先候補を整理する初動支援AIです。
        </p>
        <div className="notice" role="note">
          <strong>入力時のお願い</strong>
          <span>実在する氏名、住所、連絡先などの個人情報は入力しないでください。</span>
        </div>
      </section>
    </main>
  );
}
