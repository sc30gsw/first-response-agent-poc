import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { Result } from "better-result";
import { useRef, useState } from "react";
import {
  shouldRetryThreadApiError,
  threadApiClient,
  threadApiRetryDelay,
  ThreadApiClientError,
} from "@/lib/api-client";
import { threadQueryKeys } from "@/lib/query-keys";
import {
  threadRecordToSummary,
  type ThreadRecord,
  type ThreadState,
  type ThreadSummary,
} from "@/shared/types/thread";

type UseThreadPersistenceArgs = {
  readonly thread: ThreadRecord;
  readonly queryClient: QueryClient;
  readonly onAnnounce: (message: string) => void;
};

export function useThreadPersistence({ thread, queryClient, onAnnounce }: UseThreadPersistenceArgs) {
  const eventsRef = useRef<ThreadState["events"]>(thread.state?.events ?? []);
  const sessionRef = useRef<ThreadState["session"]>(thread.state?.session ?? { streamIndex: 0 });
  const revisionRef = useRef(thread.revision);
  const pendingSaveRef = useRef<ThreadState | null>(null);
  const saveWorkerRef = useRef<Promise<void> | null>(null);
  const saveBlockedRef = useRef(false);
  const savePausedRef = useRef(false);
  const manualSaveRetryRef = useRef(false);
  const summaryInitializedRef = useRef(thread.summary !== "");
  const pendingSummaryRef = useRef<string | null>(null);
  const [canRetrySave, setCanRetrySave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function blockSaving(message: string) {
    saveBlockedRef.current = true;
    savePausedRef.current = false;
    manualSaveRetryRef.current = false;
    pendingSaveRef.current = null;
    setCanRetrySave(false);
    setSaveError(message);
  }

  const saveThreadMutation = useMutation({
    mutationKey: ["threads", thread.id, "state"],
    mutationFn: async (state: ThreadState) => {
      const expectedRevision = revisionRef.current;
      const summary = pendingSummaryRef.current;
      const updatedThread = await threadApiClient.update({
        expectedRevision,
        id: thread.id,
        input: summary === null ? { state } : { state, summary },
      });
      if (updatedThread.revision !== expectedRevision + 1) {
        throw new ThreadApiClientError({
          code: "invalid_response",
          message: "API returned an unexpected revision",
          retryable: false,
          status: 200,
        });
      }
      return { summaryApplied: summary, updatedThread };
    },
    onError: (error) => {
      if (error instanceof ThreadApiClientError && error.code === "conflict") {
        blockSaving("別の画面で会話履歴が更新されました。最新の履歴を保つため、このページを再読み込みしてください。");
        return;
      }
      if (error instanceof ThreadApiClientError && error.code === "invalid_response") {
        setSaveError("会話履歴の保存結果を確認できませんでした。再試行し、解消しない場合はページを再読み込みしてください。");
        return;
      }
      if (error instanceof ThreadApiClientError && error.code === "network_error") {
        setSaveError("通信エラーにより会話履歴を保存できませんでした。接続を確認してください。");
        return;
      }
      setSaveError("会話履歴を保存できませんでした。ページを閉じずに再度お試しください。");
    },
    onSuccess: ({ summaryApplied, updatedThread }) => {
      if (summaryApplied !== null && pendingSummaryRef.current === summaryApplied) {
        pendingSummaryRef.current = null;
      }
      const summary = threadRecordToSummary(updatedThread);
      revisionRef.current = updatedThread.revision;
      queryClient.setQueryData(threadQueryKeys.detail(thread.id), updatedThread);
      queryClient.setQueriesData<ThreadSummary[]>(
        { queryKey: threadQueryKeys.lists() },
        cached => cached?.map(item => item.id === summary.id ? summary : item),
      );
      savePausedRef.current = false;
      setCanRetrySave(false);
      if (!saveBlockedRef.current) setSaveError(null);
      if (manualSaveRetryRef.current) {
        manualSaveRetryRef.current = false;
        onAnnounce("会話履歴を保存しました。");
      }
    },
    retry: shouldRetryThreadApiError,
    retryDelay: threadApiRetryDelay,
    scope: { id: `thread-state:${thread.id}` },
  });

  function currentThreadState(): ThreadState {
    return {
      events: [...eventsRef.current],
      session: { ...sessionRef.current },
    };
  }

  function enqueueStateSave(state: ThreadState) {
    if (saveBlockedRef.current) return;
    pendingSaveRef.current = state;
    if (savePausedRef.current || saveWorkerRef.current) return;

    const worker = (async () => {
      while (pendingSaveRef.current && !saveBlockedRef.current) {
        const nextState = pendingSaveRef.current;
        pendingSaveRef.current = null;
        const saved = await Result.tryPromise({
          try: () => saveThreadMutation.mutateAsync(nextState),
          catch: cause => cause,
        });
        if (Result.isError(saved)) {
          if (!saveBlockedRef.current) {
            pendingSaveRef.current ??= nextState;
            savePausedRef.current = true;
            manualSaveRetryRef.current = false;
            setCanRetrySave(true);
            onAnnounce("会話履歴を保存できませんでした。保存を再試行できます。");
          }
          break;
        }
      }
    })();

    saveWorkerRef.current = worker;
    void worker.finally(() => {
      if (saveWorkerRef.current === worker) saveWorkerRef.current = null;
      if (pendingSaveRef.current && !saveBlockedRef.current && !savePausedRef.current) {
        enqueueStateSave(pendingSaveRef.current);
      }
    });
  }

  function retryStateSave() {
    const pendingState = pendingSaveRef.current;
    if (!pendingState || saveBlockedRef.current || !savePausedRef.current || saveWorkerRef.current) return;

    savePausedRef.current = false;
    manualSaveRetryRef.current = true;
    setCanRetrySave(false);
    onAnnounce("会話履歴の保存を再試行しています。");
    enqueueStateSave(pendingState);
  }

  function beginFirstMessageSummaryIfNeeded(message: string, normalize: (message: string) => string) {
    const isFirstMessage = !summaryInitializedRef.current;
    if (isFirstMessage) pendingSummaryRef.current = normalize(message);
    return isFirstMessage;
  }

  function commitFirstMessageSummary() {
    summaryInitializedRef.current = true;
  }

  function rollbackFirstMessageSummary() {
    pendingSummaryRef.current = null;
  }

  return {
    eventsRef,
    sessionRef,
    currentThreadState,
    enqueueStateSave,
    retryStateSave,
    blockSaving,
    canRetrySave,
    saveError,
    beginFirstMessageSummaryIfNeeded,
    commitFirstMessageSummary,
    rollbackFirstMessageSummary,
  };
}
