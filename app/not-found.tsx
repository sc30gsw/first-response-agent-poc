import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-8">
      <section className="w-full max-w-[720px] rounded-3xl border border-line bg-white/92 p-[clamp(28px,6vw,64px)] shadow-[0_24px_70px_rgb(16_38_59/10%)]">
        <p className="mb-3 text-[0.8rem] font-bold tracking-[0.12em] text-[#176c67]">404</p>
        <h1 className="m-0 text-[clamp(2rem,6vw,3.6rem)] leading-[1.15] tracking-[-0.035em]">ページが見つかりません</h1>
        <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-navy px-[18px] py-2.5 font-bold text-white no-underline hover:bg-navy-deep" href="/">
          トップへ戻る
        </Link>
      </section>
    </main>
  );
}
