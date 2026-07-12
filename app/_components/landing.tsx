"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { anonymousAuth } from "@/lib/auth-client";
import { authQueryKeys } from "@/lib/query-keys";
import { BrandMark } from "./brand-mark";

export function Landing() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const startDemoMutation = useMutation({
    mutationKey: ["auth", "anonymous-sign-in"],
    mutationFn: anonymousAuth.signInAnonymous,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
      router.replace("/");
      router.refresh();
    },
    retry: false,
    scope: { id: "auth-session" },
  });

  function startDemo() {
    startDemoMutation.mutate();
  }

  return (
    <main id="main-content" className="min-h-screen bg-canvas px-[clamp(20px,5vw,72px)] pt-7">
      <a className="fixed top-3 left-3 z-100 translate-y-[-160%] rounded-lg bg-navy-deep px-4 py-2.5 font-bold text-white no-underline focus:translate-y-0" href="#demo-start">デモ開始へ移動</a>
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between">
        <div className="inline-flex items-center gap-[11px] font-extrabold tracking-[0.02em]">
          <BrandMark />
          <span>初動支援AI</span>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-full border border-[#a8cbc7] bg-teal-pale px-2.5 py-1 text-[0.72rem] font-extrabold tracking-wider text-[#105e59]">PoC / 架空データ</span>
      </div>

      <section className="mx-auto grid min-h-[calc(100vh-190px)] w-full max-w-[1180px] items-center gap-[clamp(48px,8vw,120px)] py-[clamp(56px,9vh,104px)] lg:grid-cols-[minmax(0,1.15fr)_minmax(310px,0.75fr)]" aria-labelledby="page-title">
        <div>
          <p className="mb-3 text-[0.8rem] font-bold tracking-[0.12em] text-[#176c67]">複雑案件の初動受付</p>
          <h1 id="page-title" className="max-w-[780px] font-display text-[clamp(2.55rem,5.7vw,5.3rem)] leading-[1.24] font-semibold tracking-[-0.055em]">
            複雑な相談の初動を、
            <span className="block text-teal">一枚の見取り図に。</span>
          </h1>
          <p className="mt-[30px] max-w-[650px] text-[clamp(1rem,2.5vw,1.2rem)] leading-8 text-ink-soft">
            相続、事故・告知事項、再建築不可などが絡む相談を整理し、確認事項、類似事例、相談先候補までを初回回答で提示します。
          </p>

          <div className="mt-[38px] flex items-center gap-[22px] max-sm:flex-col max-sm:items-stretch">
            <button
              id="demo-start"
              className="inline-flex min-h-[58px] items-center justify-center gap-7 rounded-[10px] bg-navy px-6 py-3.5 font-bold text-white shadow-[0_12px_28px_rgb(18_60_86/20%)] hover:bg-navy-deep disabled:cursor-wait disabled:opacity-[.62]"
              type="button"
              disabled={startDemoMutation.isPending}
              onClick={startDemo}
            >
              {startDemoMutation.isPending ? "匿名セッションを作成中…" : "デモを開始"}
              <span aria-hidden="true">→</span>
            </button>
            <p className="m-0 max-w-[250px] text-[0.78rem] leading-[1.7] text-ink-soft">アカウント登録は不要です。匿名セッションは24時間で失効します。</p>
          </div>

          {startDemoMutation.isError ? (
            <p className="text-[0.82rem] font-bold text-danger" role="alert">デモを開始できませんでした。時間をおいて再度お試しください。</p>
          ) : null}
        </div>

        <aside className="relative border border-[#bdcbc9] bg-paper p-7 shadow-[18px_22px_0_#dfe9e6,0_26px_70px_rgb(16_38_59/14%)] rotate-[1.1deg] max-lg:justify-self-center max-lg:w-[min(500px,92%)]" aria-label="デモで確認できる内容">
          <div className="flex justify-between border-b-2 border-navy pb-5 font-display font-bold">
            <span>初動整理票</span>
            <span className="tracking-[0.12em] text-teal">デモ</span>
          </div>
          <ol className="my-[18px] mb-7 grid list-none p-0" role="list">
            <li className="flex min-h-12 items-center gap-[18px] pl-1.5 text-[0.9rem] font-bold"><span className="w-6 text-[0.72rem] font-extrabold text-teal">01</span>案件要約と優先度</li>
            <li className="flex min-h-12 items-center gap-[18px] pl-1.5 text-[0.9rem] font-bold"><span className="w-6 text-[0.72rem] font-extrabold text-teal">02</span>不足情報と初動確認事項</li>
            <li className="flex min-h-12 items-center gap-[18px] pl-1.5 text-[0.9rem] font-bold"><span className="w-6 text-[0.72rem] font-extrabold text-teal">03</span>類似事例と社内ガイド</li>
            <li className="flex min-h-12 items-center gap-[18px] pl-1.5 text-[0.9rem] font-bold"><span className="w-6 text-[0.72rem] font-extrabold text-teal">04</span>有識者候補と相談文</li>
          </ol>
          <div className="ml-auto w-fit -rotate-2 border-2 border-[#a35d2a] px-[11px] py-[7px] text-[0.7rem] font-extrabold tracking-[0.04em] text-[#8b4c1f]">最終判断は人間が行います</div>
        </aside>
      </section>

      <div className="-mx-[clamp(20px,5vw,72px)] flex min-h-[62px] items-center gap-6 border-t border-[#ead7af] bg-amber-pale px-[max(clamp(20px,5vw,72px),calc((100vw-1180px)/2))] py-3.5 text-[0.8rem] leading-[1.6] text-[#59431b] max-sm:flex-col max-sm:items-stretch" role="note">
        <strong>入力前にご確認ください</strong>
        <span>実在する氏名、住所、連絡先などの個人情報は入力しないでください。入力内容はLLM APIへ送信されます。</span>
      </div>
    </main>
  );
}
