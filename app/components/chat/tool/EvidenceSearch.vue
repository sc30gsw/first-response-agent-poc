<script setup lang="ts">
import type { DynamicToolUIPart } from "ai";
import type { Expert } from "~~/shared/tools/first-response";
import type {
  EvidenceSearchToolName,
  ExpertsUIToolInvocation,
  GuidesUIToolInvocation,
  SimilarCasesUIToolInvocation,
} from "~~/shared/utils/tools/first-response";

const props = defineProps<{
  invocation: DynamicToolUIPart;
  toolName: EvidenceSearchToolName;
  streaming?: boolean;
  canRespond?: boolean;
}>();

const emit = defineEmits<{
  sendMessage: [text: string];
}>();

const TITLES: Record<EvidenceSearchToolName, string> = {
  search_similar_cases: "類似事例",
  search_guides: "社内初動ガイド",
  search_experts: "有識者候補",
};

const ICONS: Record<EvidenceSearchToolName, string> = {
  search_similar_cases: "i-lucide-files",
  search_guides: "i-lucide-book-open-check",
  search_experts: "i-lucide-users",
};

const isLoading = computed(
  () => props.invocation.state !== "output-available" && props.invocation.state !== "output-error",
);

function requestDraft(expert: Expert) {
  emit(
    "sendMessage",
    `${expert.name}（社員ID: ${expert.id}）への相談依頼文の下書きを作成してください。`,
  );
}
</script>

<template>
  <div
    v-if="isLoading"
    class="my-5 flex w-full max-w-md items-center gap-2 rounded-xl border border-default px-4 py-3 text-sm text-muted"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="size-4 animate-spin"
    />
    {{ TITLES[toolName] }}を検索しています…
  </div>

  <div
    v-else-if="invocation.state === 'output-error'"
    class="my-5 w-full max-w-md rounded-xl border border-error/50 bg-error/5 px-4 py-3 text-sm text-error"
  >
    {{ TITLES[toolName] }}の検索に失敗しました。もう一度お試しください。
  </div>

  <div
    v-else
    class="my-5 w-full shrink-0 overflow-hidden rounded-xl border border-default"
  >
    <header class="flex items-center gap-1.5 border-b border-default bg-elevated px-4 py-3">
      <UIcon
        :name="ICONS[toolName]"
        class="size-4 text-muted"
      />
      <span class="text-sm font-semibold text-highlighted">{{ TITLES[toolName] }}</span>
    </header>

    <div class="p-4">
      <ChatToolCaseMatchList
        v-if="toolName === 'search_similar_cases'"
        :result="(invocation as SimilarCasesUIToolInvocation).output"
      />
      <ChatToolGuideMatchList
        v-else-if="toolName === 'search_guides'"
        :result="(invocation as GuidesUIToolInvocation).output"
      />
      <ChatToolExpertMatchList
        v-else
        :result="(invocation as ExpertsUIToolInvocation).output"
        :can-respond="canRespond"
        @draft-request="requestDraft"
      />
    </div>
  </div>
</template>
