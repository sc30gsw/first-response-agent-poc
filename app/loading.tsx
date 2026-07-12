const SKELETON_THREAD_KEYS = ["one", "two", "three", "four"] as const satisfies readonly string[];

const SKELETON = "block animate-skeleton-shimmer rounded-full bg-[linear-gradient(90deg,#dce6e3_25%,#f2f6f5_50%,#dce6e3_75%)] bg-[size:200%_100%]";

export default function Loading() {
  return (
    <main className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)] bg-canvas max-sm:grid-cols-1 max-sm:grid-rows-[60px_auto_minmax(0,1fr)]" aria-busy="true">
      <p className="sr-only">画面を読み込んでいます</p>
      <div className="col-span-full flex items-center justify-between border-b border-line bg-paper px-5 max-sm:col-span-1" aria-hidden="true">
        <span className={`${SKELETON} h-[30px] w-[150px]`} />
        <span className={`${SKELETON} h-7 w-[92px]`} />
      </div>
      <aside className="grid content-start gap-3.5 border-r border-line bg-[#edf3f1] px-3.5 py-[18px] max-sm:max-h-[170px] max-sm:grid-cols-2 max-sm:overflow-hidden max-sm:border-r-0 max-sm:border-b" aria-hidden="true">
        <span className={`${SKELETON} col-span-full h-[46px] w-full rounded-[10px]`} />
        <span className={`${SKELETON} col-span-full mt-3 ml-2 h-[11px] w-[86px]`} />
        {SKELETON_THREAD_KEYS.map((key) => (
          <span key={key} className="grid gap-[7px] px-3 py-[9px]">
            <span className={`${SKELETON} h-3 w-[84%]`} />
            <span className={`${SKELETON} h-[9px] w-[58%]`} />
          </span>
        ))}
      </aside>
      <section className="mx-auto grid w-full max-w-[1120px] content-start gap-7 p-[clamp(28px,5vw,64px)] max-sm:px-[18px] max-sm:py-7" aria-hidden="true">
        <header className="grid gap-3 border-b border-line pb-7">
          <span className={`${SKELETON} h-3 w-[92px]`} />
          <span className={`${SKELETON} h-12 w-[min(540px,72%)] rounded-[10px]`} />
        </header>
        <div className="grid gap-3.5 rounded-[4px_18px_4px_4px] border border-control-line bg-paper p-6">
          <span className={`${SKELETON} h-[18px] w-[180px]`} />
          <span className={`${SKELETON} h-[13px] w-full`} />
          <span className={`${SKELETON} h-[13px] w-[72%]`} />
          <span className={`${SKELETON} h-[13px] w-[46%]`} />
        </div>
        <div className="m-auto mb-0 grid min-h-[150px] w-full max-w-[780px] self-end gap-3.5 rounded-[14px] border border-control-line bg-paper p-6">
          <span className={`${SKELETON} h-[13px] w-full`} />
          <span className={`${SKELETON} h-[13px] w-[72%]`} />
          <span className={`${SKELETON} h-[42px] w-32 justify-self-end rounded-[10px]`} />
        </div>
      </section>
    </main>
  );
}
