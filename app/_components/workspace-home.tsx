"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { z } from "zod";
import { cn } from "cnfast";
import { threadApiClient } from "@/lib/api-client";
import { threadQueryKeys } from "@/lib/query-keys";
import { SAMPLE_CASES } from "@/lib/sample-cases";
import type { ThreadSummary } from "@/shared/types/thread";
import { truncateThreadTitle } from "@/shared/types/thread";
import { WorkspaceShell } from "./workspace-shell";
import { useAppForm } from "./app-form";

const MAX_CASE_NAME_CHARS = 60;

type SampleCase = (typeof SAMPLE_CASES)[number];
type CreateThreadVariables = {
  readonly name: string;
  readonly prompt: string | null;
};

export function WorkspaceHome({ threads }: { readonly threads: readonly ThreadSummary[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [pendingSample, setPendingSample] = useState<SampleCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createThread = useMutation({
    mutationKey: ["threads", "create"],
    mutationFn: ({ name }: CreateThreadVariables) => threadApiClient.create({
      title: truncateThreadTitle(name),
    }),
    onError: () => {
      setError("相談を開始できませんでした。再度お試しください。");
    },
    onSuccess: async (thread, { prompt }) => {
      queryClient.setQueryData(threadQueryKeys.detail(thread.id), thread);
      await queryClient.invalidateQueries({ queryKey: threadQueryKeys.lists() });
      if (prompt) {
        const stored = Result.try({
          try: () => sessionStorage.setItem(`thread-draft:${thread.id}`, prompt),
          catch: cause => cause,
        });
        if (Result.isError(stored)) {
          setError("ブラウザの一時保存を利用できません。設定を確認してください。");
          return;
        }
      }

      router.push(`/chat/${thread.id}`);
    },
    retry: false,
    scope: { id: "thread-create" },
  });
  const form = useAppForm({
    defaultValues: { caseName: "" },
    onSubmit: ({ value }) => {
      setError(null);
      createThread.mutate({
        name: value.caseName.trim(),
        prompt: pendingSample?.prompt ?? null,
      });
    },
    onSubmitInvalid: () => {
      // The field-level error takes over the single role="alert" region; drop
      // any stale mutation error so two alerts never show at once.
      setError(null);
      nameInputRef.current?.focus();
    },
  });

  function chooseSample(sample: SampleCase) {
    form.setFieldValue("caseName", sample.label);
    setPendingSample(sample);
    nameInputRef.current?.focus();
  }

  function clearPendingSample() {
    setPendingSample(null);
  }

  return (
    <WorkspaceShell threads={threads}>
      <div className="mx-auto w-full max-w-[1120px] p-[clamp(28px,5vw,64px)] max-sm:px-[18px] max-sm:py-7">
        <header className="flex items-end justify-between gap-8 border-b border-line pb-7 max-sm:flex-col max-sm:items-start">
          <div>
            <p className="mb-3 text-[0.8rem] font-bold tracking-[0.12em] text-[#176c67]">新規相談</p>
            <h1 className="font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.04em]">相談内容を整理する</h1>
          </div>
          <p className="m-0 max-w-[360px] text-[0.85rem] leading-[1.8] text-ink-soft">サンプルを選ぶか、案件名を入力してください。実際の相談内容は次の画面で入力します。</p>
        </header>

        <section className="mt-[38px]" aria-labelledby="sample-heading">
          <div className="mb-[13px] flex items-center justify-between">
            <h2 id="sample-heading" className="m-0 text-[0.9rem] tracking-[0.04em]">サンプル案件</h2>
            <span className="text-[0.7rem] text-ink-soft">すべて架空の内容です</span>
          </div>
          <div className="grid gap-3.5 lg:grid-cols-3">
            {SAMPLE_CASES.map((sample) => (
              <button key={sample.id} className={cn("relative grid min-h-[190px] content-start gap-2 overflow-hidden rounded-[4px_18px_4px_4px] border border-control-line bg-paper p-[22px] text-left text-ink transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[#9ebbb7] hover:shadow-[0_14px_34px_rgb(16_38_59/9%)] before:absolute before:inset-y-0 before:left-0 before:w-[5px] before:bg-teal max-lg:min-h-[155px]", sample.id === "stigmatized" && "before:bg-amber", sample.id === "non_rebuildable" && "before:bg-navy")} type="button" onClick={() => chooseSample(sample)}>
                <span className="text-[0.65rem] font-black tracking-[0.12em] text-teal">{sample.code}</span>
                <strong className="mt-2.5 font-display text-[1.15rem]">{sample.label}</strong>
                <span className="text-[0.77rem] leading-[1.65] text-ink-soft">{sample.summary}</span>
                <span className="mt-auto self-end text-[0.72rem] font-extrabold text-navy">案件名に反映 <span aria-hidden="true">↘</span></span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7 rounded-[14px] border border-control-line bg-paper p-5 shadow-[0_18px_50px_rgb(16_38_59/7%)] focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgb(25_119_113/15%),0_18px_50px_rgb(16_38_59/7%)]" aria-labelledby="composer-heading">
          <form onSubmit={event => {
            event.preventDefault();
            void form.handleSubmit();
          }}>
          <form.AppForm>
            <div className="mb-[13px] flex items-center justify-between">
              <label htmlFor="case-input" className="m-0 text-base tracking-[0.04em] cursor-text">案件名</label>
              <form.Subscribe selector={state => state.values.caseName.length}>
                {length => <span className="text-[0.7rem] text-ink-soft">{length.toLocaleString("ja-JP")} / {MAX_CASE_NAME_CHARS.toLocaleString("ja-JP")} 文字</span>}
              </form.Subscribe>
            </div>
            <form.AppField
              name="caseName"
              validators={{
                // onChange lets a submit-blocked form recover as soon as the
                // user types; the empty check stays on submit so the field is
                // not flagged while the user has simply not typed yet.
                onChange: z.string().max(MAX_CASE_NAME_CHARS, `案件名は${MAX_CASE_NAME_CHARS}文字以内で入力してください。`),
                onSubmit: z.string().trim().min(1, "案件名を入力してください。"),
              }}
            >
              {field => {
                const fieldError = field.state.meta.errors.at(0);
                const errorMessage = typeof fieldError === "string" ? fieldError : fieldError?.message;
                return <>
                  <input
                    ref={nameInputRef}
                    id="case-input"
                    type="text"
                    value={field.state.value}
                    maxLength={MAX_CASE_NAME_CHARS}
                    aria-describedby="privacy-reminder"
                    aria-invalid={errorMessage ? true : undefined}
                    placeholder="例：相続した空き家の共有名義について"
                    className="w-full border-0 bg-transparent text-[0.94rem] leading-[1.85] text-ink outline-none"
                    onBlur={field.handleBlur}
                    onChange={event => field.handleChange(event.target.value.slice(0, MAX_CASE_NAME_CHARS))}
                  />
                  {errorMessage ? <p className="text-[0.82rem] font-bold text-danger" role="alert">{errorMessage}</p> : null}
                </>;
              }}
            </form.AppField>
            {pendingSample ? (
              <p className="m-0 mt-2.5 flex items-center gap-2.5 text-[0.78rem] text-[#176c67]">
                「{pendingSample.label}」の相談内容を次の画面へ引き継ぎます
                <button className="cursor-pointer border-0 bg-transparent p-0 font-bold text-ink-soft underline decoration-dotted underline-offset-2" type="button" onClick={clearPendingSample}>
                  引き継ぎを取り消す
                </button>
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-5 border-t border-[#e7eceb] pt-3.5 max-sm:flex-col max-sm:items-stretch">
              <p id="privacy-reminder" className="m-0 flex items-center gap-[7px] text-[0.72rem] text-[#75581d]"><span className="grid size-[18px] place-items-center rounded-full bg-amber-pale font-black" aria-hidden="true">!</span> 実在する氏名・住所・連絡先などは入力しないでください。</p>
              <form.Subscribe selector={state => state.canSubmit}>
                {canSubmit => (
                  <button className="inline-flex min-h-11 items-center justify-center gap-[22px] rounded-[10px] bg-navy px-[18px] py-2.5 font-bold text-white hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-[.62] max-sm:w-full" type="submit" disabled={!canSubmit || createThread.isPending}>
                    {createThread.isPending ? "相談票を作成中…" : "この内容で相談を開始"}
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </form.Subscribe>
            </div>
            {error ? <p className="text-[0.82rem] font-bold text-danger" role="alert">{error}</p> : null}
          </form.AppForm>
          </form>
        </section>
      </div>
    </WorkspaceShell>
  );
}
