"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "cnfast";
import { threadApiClient } from "@/lib/api-client";
import { threadQueryKeys } from "@/lib/query-keys";
import { SAMPLE_CASES } from "@/lib/sample-cases";
import { MAX_CHAT_MESSAGE_CHARS } from "@/shared/chat-limits";
import type { ThreadSummary } from "@/shared/types/thread";
import {
  normalizeThreadSummary,
  truncateThreadTitle,
} from "@/shared/types/thread";
import { WorkspaceShell } from "./workspace-shell";

export function WorkspaceHome({ threads }: { readonly threads: readonly ThreadSummary[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createThread = useMutation({
    mutationKey: ["threads", "create"],
    mutationFn: (message: string) => threadApiClient.create({
      summary: normalizeThreadSummary(message),
      title: truncateThreadTitle(message),
    }),
    onError: () => {
      setError("相談を開始できませんでした。再度お試しください。");
    },
    onSuccess: async (thread, message) => {
      queryClient.setQueryData(threadQueryKeys.detail(thread.id), thread);
      await queryClient.invalidateQueries({ queryKey: threadQueryKeys.lists() });
      const stored = Result.try({
        try: () => sessionStorage.setItem(`thread-draft:${thread.id}`, message),
        catch: cause => cause,
      });
      if (Result.isError(stored)) {
        setError("ブラウザの一時保存を利用できません。設定を確認してください。");
        return;
      }

      router.push(`/chat/${thread.id}`);
    },
    retry: false,
    scope: { id: "thread-create" },
  });

  function chooseSample(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  function submitCase() {
    const message = draft.trim();
    if (!message) {
      setError("相談内容を入力してください。");
      textareaRef.current?.focus();
      return;
    }

    setError(null);
    createThread.mutate(message);
  }

  return (
    <WorkspaceShell threads={threads}>
      <div className="mx-auto w-full max-w-[1120px] p-[clamp(28px,5vw,64px)] max-sm:px-[18px] max-sm:py-7">
        <header className="flex items-end justify-between gap-8 border-b border-line pb-7 max-sm:flex-col max-sm:items-start">
          <div>
            <p className="mb-3 text-[0.8rem] font-bold tracking-[0.12em] text-[#176c67]">新規相談</p>
            <h1 className="font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.04em]">相談内容を整理する</h1>
          </div>
          <p className="m-0 max-w-[360px] text-[0.85rem] leading-[1.8] text-ink-soft">サンプルを選ぶか、相談内容を自由に入力してください。</p>
        </header>

        <section className="mt-[38px]" aria-labelledby="sample-heading">
          <div className="mb-[13px] flex items-center justify-between">
            <h2 id="sample-heading" className="m-0 text-[0.9rem] tracking-[0.04em]">サンプル案件</h2>
            <span className="text-[0.7rem] text-ink-soft">すべて架空の内容です</span>
          </div>
          <div className="grid gap-3.5 lg:grid-cols-3">
            {SAMPLE_CASES.map((sample) => (
              <button key={sample.id} className={cn("relative grid min-h-[190px] content-start gap-2 overflow-hidden rounded-[4px_18px_4px_4px] border border-control-line bg-paper p-[22px] text-left text-ink transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[#9ebbb7] hover:shadow-[0_14px_34px_rgb(16_38_59/9%)] before:absolute before:inset-y-0 before:left-0 before:w-[5px] before:bg-teal max-lg:min-h-[155px]", sample.id === "stigmatized" && "before:bg-amber", sample.id === "non_rebuildable" && "before:bg-navy")} type="button" onClick={() => chooseSample(sample.prompt)}>
                <span className="text-[0.65rem] font-black tracking-[0.12em] text-teal">{sample.code}</span>
                <strong className="mt-2.5 font-display text-[1.15rem]">{sample.label}</strong>
                <span className="text-[0.77rem] leading-[1.65] text-ink-soft">{sample.summary}</span>
                <span className="mt-auto self-end text-[0.72rem] font-extrabold text-navy">入力欄に反映 <span aria-hidden="true">↘</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7 rounded-[14px] border border-control-line bg-paper p-5 shadow-[0_18px_50px_rgb(16_38_59/7%)] focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgb(25_119_113/15%),0_18px_50px_rgb(16_38_59/7%)]" aria-labelledby="composer-heading">
          <div className="mb-[13px] flex items-center justify-between">
            <label htmlFor="case-input" className="m-0 text-base tracking-[0.04em] cursor-text">相談内容</label>
            <span className="text-[0.7rem] text-ink-soft">{draft.length.toLocaleString("ja-JP")} / {MAX_CHAT_MESSAGE_CHARS.toLocaleString("ja-JP")} 文字</span>
          </div>
          <textarea
            ref={textareaRef}
            id="case-input"
            value={draft}
            rows={7}
            maxLength={MAX_CHAT_MESSAGE_CHARS}
            aria-describedby="privacy-reminder"
            aria-invalid={error ? true : undefined}
            placeholder="例：相続した空き家を兄弟で共有しています。一人と連絡が取れず、建物の老朽化も進んでいます…"
            className="w-full resize-y border-0 bg-transparent text-[0.94rem] leading-[1.85] text-ink outline-none"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center justify-between gap-5 border-t border-[#e7eceb] pt-3.5 max-sm:flex-col max-sm:items-stretch">
            <p id="privacy-reminder" className="m-0 flex items-center gap-[7px] text-[0.72rem] text-[#75581d]"><span className="grid size-[18px] place-items-center rounded-full bg-amber-pale font-black" aria-hidden="true">!</span> 実在する氏名・住所・連絡先などは入力しないでください。</p>
            <button className="inline-flex min-h-11 items-center justify-center gap-[22px] rounded-[10px] bg-navy px-[18px] py-2.5 font-bold text-white hover:bg-navy-deep disabled:cursor-wait disabled:opacity-[.62] max-sm:w-full" type="button" disabled={createThread.isPending} onClick={submitCase}>
              {createThread.isPending ? "相談票を作成中…" : "この内容で相談を開始"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {error ? <p className="text-[0.82rem] font-bold text-danger" role="alert">{error}</p> : null}
        </section>
      </div>
    </WorkspaceShell>
  );
}
