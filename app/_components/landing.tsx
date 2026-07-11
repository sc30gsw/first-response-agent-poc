"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { BrandMark } from "./brand-mark";

export function Landing() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startDemo() {
    setError(null);
    startTransition(async () => {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        setError("デモを開始できませんでした。時間をおいて再度お試しください。");
        return;
      }

      router.refresh();
    });
  }

  return (
    <main id="main-content" className="intake-landing">
      <a className="skip-link" href="#demo-start">デモ開始へ移動</a>
      <div className="landing-masthead">
        <div className="product-lockup">
          <BrandMark />
          <span>初動支援AI</span>
        </div>
        <span className="poc-chip">PoC / 架空データ</span>
      </div>

      <section className="landing-grid" aria-labelledby="page-title">
        <div className="landing-copy">
          <p className="eyebrow">COMPLEX CASE INTAKE</p>
          <h1 id="page-title">
            複雑な相談の初動を、
            <span>一枚の見取り図に。</span>
          </h1>
          <p className="lead">
            相続、事故・告知事項、再建築不可などが絡む相談を整理し、確認事項、類似事例、相談先候補までを初回回答で提示します。
          </p>

          <div className="landing-actions">
            <button
              id="demo-start"
              className="primary-button primary-button--large"
              type="button"
              disabled={isPending}
              onClick={startDemo}
            >
              {isPending ? "匿名セッションを作成中…" : "デモを開始"}
              <span aria-hidden="true">→</span>
            </button>
            <p>アカウント登録は不要です。匿名セッションは24時間で失効します。</p>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>

        <aside className="intake-sheet" aria-label="デモで確認できる内容">
          <div className="sheet-header">
            <span>初動整理票</span>
            <span>DEMO</span>
          </div>
          <ol className="sheet-list">
            <li><span>01</span>案件要約と優先度</li>
            <li><span>02</span>不足情報と初動確認事項</li>
            <li><span>03</span>類似事例と社内ガイド</li>
            <li><span>04</span>有識者候補と相談文</li>
          </ol>
          <div className="sheet-stamp">最終判断は人間が行います</div>
        </aside>
      </section>

      <div className="privacy-band" role="note">
        <strong>入力前にご確認ください</strong>
        <span>実在する氏名、住所、連絡先などの個人情報は入力しないでください。入力内容はLLM APIへ送信されます。</span>
      </div>
    </main>
  );
}
