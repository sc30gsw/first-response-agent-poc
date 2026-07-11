const SKELETON_THREAD_KEYS = ["one", "two", "three", "four"] as const satisfies readonly string[];

export default function Loading() {
  return (
    <main className="loading-workspace" aria-busy="true">
      <p className="visually-hidden">画面を読み込んでいます</p>
      <div className="loading-header" aria-hidden="true">
        <span className="skeleton-block skeleton-brand" />
        <span className="skeleton-block skeleton-chip" />
      </div>
      <aside className="loading-sidebar" aria-hidden="true">
        <span className="skeleton-block skeleton-new-thread" />
        <span className="skeleton-block skeleton-label" />
        {SKELETON_THREAD_KEYS.map((key) => (
          <span key={key} className="skeleton-thread">
            <span className="skeleton-block" />
            <span className="skeleton-block" />
          </span>
        ))}
      </aside>
      <section className="loading-content" aria-hidden="true">
        <header className="loading-content-header">
          <span className="skeleton-block skeleton-eyebrow" />
          <span className="skeleton-block skeleton-title" />
        </header>
        <div className="loading-document">
          <span className="skeleton-block skeleton-section-title" />
          <span className="skeleton-block skeleton-line skeleton-line--wide" />
          <span className="skeleton-block skeleton-line" />
          <span className="skeleton-block skeleton-line skeleton-line--short" />
        </div>
        <div className="loading-composer">
          <span className="skeleton-block skeleton-line skeleton-line--wide" />
          <span className="skeleton-block skeleton-line" />
          <span className="skeleton-block skeleton-action" />
        </div>
      </section>
    </main>
  );
}
