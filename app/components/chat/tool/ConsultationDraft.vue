<script setup lang="ts">
import type { DraftConsultationUIToolInvocation } from "~~/shared/utils/tools/first-response";

const props = defineProps<{
  invocation: DraftConsultationUIToolInvocation;
  streaming?: boolean;
}>();

const isError = computed(() => (props.invocation.state as string) === "output-error");

const isLoading = computed(
  () => props.invocation.state !== "output-available" && !isError.value,
);

const draft = computed(() =>
  props.invocation.state === "output-available" && props.invocation.output.ok
    ? props.invocation.output.draft
    : null,
);

const failureMessage = computed(() =>
  props.invocation.state === "output-available" && !props.invocation.output.ok
    ? props.invocation.output.message
    : null,
);

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copyDraft() {
  if (!draft.value) return;
  await navigator.clipboard.writeText(`件名: ${draft.value.subject}\n\n${draft.value.body}`);
  copied.value = true;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
  }, 2000);
}

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});
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
    相談依頼文の下書きを作成しています…
  </div>

  <div
    v-else-if="isError"
    class="my-5 w-full max-w-md rounded-xl border border-error/50 bg-error/5 px-4 py-3 text-sm text-error"
  >
    下書きの作成に失敗しました。もう一度お試しください。
  </div>

  <div
    v-else-if="failureMessage"
    class="my-5 w-full max-w-md rounded-xl border border-warning/50 bg-warning/5 px-4 py-3 text-sm text-toned"
  >
    {{ failureMessage }}
  </div>

  <div
    v-else-if="draft"
    class="my-5 w-full shrink-0 overflow-hidden rounded-xl border border-default"
  >
    <header class="flex flex-wrap items-center justify-between gap-2 border-b border-default bg-elevated px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <UIcon
          name="i-lucide-mail-plus"
          class="size-4 text-muted"
        />
        <span class="text-sm font-semibold text-highlighted">相談依頼文の下書き</span>
        <UBadge
          color="warning"
          variant="subtle"
        >
          {{ draft.priorityLabel }}
        </UBadge>
      </div>
      <UButton
        size="xs"
        color="neutral"
        :variant="copied ? 'soft' : 'outline'"
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        @click="copyDraft"
      >
        {{ copied ? "コピーしました" : "下書きをコピー" }}
      </UButton>
    </header>

    <div class="space-y-3 p-4">
      <dl class="space-y-1 text-sm">
        <div>
          <dt class="inline font-medium text-muted">
            宛先:
          </dt>
          <dd class="inline text-toned">
            {{ draft.recipient.name }}（{{ draft.recipient.department }} / {{ draft.recipient.id }}）
          </dd>
        </div>
        <div>
          <dt class="inline font-medium text-muted">
            件名:
          </dt>
          <dd class="inline text-toned">
            {{ draft.subject }}
          </dd>
        </div>
        <div v-if="draft.referencedCaseIds.length || draft.referencedGuideIds.length">
          <dt class="inline font-medium text-muted">
            参照した事例・ガイド:
          </dt>
          <dd class="inline">
            <UBadge
              v-for="id in [...draft.referencedCaseIds, ...draft.referencedGuideIds]"
              :key="id"
              size="sm"
              color="neutral"
              variant="subtle"
              class="me-1"
            >
              {{ id }}
            </UBadge>
          </dd>
        </div>
      </dl>

      <pre class="overflow-x-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap text-toned">{{ draft.body }}</pre>

      <p class="flex items-start gap-1.5 text-xs text-warning">
        <UIcon
          name="i-lucide-shield-alert"
          class="mt-0.5 size-3.5 shrink-0"
        />
        {{ draft.piiNotice }}
      </p>

      <p class="text-xs text-dimmed">
        実際のメール・チャット送信は行いません。コピーして利用してください。
      </p>
    </div>
  </div>
</template>
