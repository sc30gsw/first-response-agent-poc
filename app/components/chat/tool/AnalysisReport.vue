<script setup lang="ts">
import type { Expert } from "~~/shared/tools/first-response";
import type { AnalyzeCaseUIToolInvocation } from "~~/shared/utils/tools/first-response";

const props = defineProps<{
  invocation: AnalyzeCaseUIToolInvocation;
  streaming?: boolean;
  canRespond?: boolean;
}>();

const emit = defineEmits<{
  sendMessage: [text: string];
}>();

const isError = computed(() => (props.invocation.state as string) === "output-error");

const isLoading = computed(
  () => props.invocation.state !== "output-available" && !isError.value,
);

const report = computed(() =>
  props.invocation.state === "output-available" ? props.invocation.output.report : null,
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
    案件を分析しています…
  </div>

  <div
    v-else-if="isError"
    class="my-5 w-full max-w-md rounded-xl border border-error/50 bg-error/5 px-4 py-3 text-sm text-error"
  >
    分析に失敗しました。もう一度お試しください。
  </div>

  <div
    v-else-if="report"
    class="my-5 w-full shrink-0 overflow-hidden rounded-xl border border-default"
  >
    <header class="border-b border-default bg-elevated px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          :color="invocation.output.analysisType === 'initial' ? 'primary' : 'info'"
          variant="solid"
        >
          {{ invocation.output.analysisLabel }}
        </UBadge>
        <span
          v-if="invocation.output.categoryLabel"
          class="text-sm font-medium text-highlighted"
        >
          {{ invocation.output.categoryLabel }}
        </span>
        <UBadge
          color="warning"
          variant="subtle"
        >
          優先度: {{ invocation.output.priorityLabel }}
        </UBadge>
      </div>
      <ul
        v-if="report.priority.reasons.length"
        class="mt-2 list-disc space-y-0.5 ps-4 text-xs text-muted"
      >
        <li
          v-for="reason in report.priority.reasons"
          :key="reason"
        >
          {{ reason }}
        </li>
      </ul>
    </header>

    <div class="space-y-5 p-4">
      <!-- 案件要約（REQUIREMENT §7.13） -->
      <section>
        <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-highlighted">
          <UIcon
            name="i-lucide-clipboard-list"
            class="size-4"
          />
          案件要約
        </h3>
        <dl class="space-y-1 text-sm">
          <div>
            <dt class="inline font-medium text-muted">
              顧客の希望:
            </dt>
            <dd class="inline text-toned">
              {{ report.caseSummary.customerWish }}
            </dd>
          </div>
          <div>
            <dt class="inline font-medium text-muted">
              現在の問題:
            </dt>
            <dd class="inline text-toned">
              {{ report.caseSummary.currentProblem }}
            </dd>
          </div>
          <div v-if="report.caseSummary.propertyState.length">
            <dt class="inline font-medium text-muted">
              物件状態:
            </dt>
            <dd class="inline text-toned">
              {{ report.caseSummary.propertyState.join("、") }}
            </dd>
          </div>
          <div v-if="report.caseSummary.rights.length">
            <dt class="inline font-medium text-muted">
              権利関係:
            </dt>
            <dd class="inline text-toned">
              {{ report.caseSummary.rights.join("、") }}
            </dd>
          </div>
          <div v-if="report.caseSummary.stakeholders.length">
            <dt class="inline font-medium text-muted">
              関係者:
            </dt>
            <dd class="inline text-toned">
              {{ report.caseSummary.stakeholders.join("、") }}
            </dd>
          </div>
          <div v-if="report.caseSummary.unknowns.length">
            <dt class="inline font-medium text-muted">
              不明点:
            </dt>
            <dd class="inline text-toned">
              {{ report.caseSummary.unknowns.join("、") }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- 確認事項（REQUIREMENT §7.13） -->
      <section>
        <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-highlighted">
          <UIcon
            name="i-lucide-list-checks"
            class="size-4"
          />
          確認事項
        </h3>
        <ol
          v-if="report.actionItems.length"
          class="list-decimal space-y-1 ps-5 text-sm text-toned"
        >
          <li
            v-for="item in report.actionItems"
            :key="item"
          >
            {{ item }}
          </li>
        </ol>

        <div
          v-if="report.missingInfo.length"
          class="mt-2"
        >
          <p class="text-xs font-medium text-muted">
            不足している情報
          </p>
          <ul class="mt-1 list-disc space-y-0.5 ps-4 text-sm text-toned">
            <li
              v-for="item in report.missingInfo"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>

        <div
          v-if="report.humanEscalation.length"
          class="mt-2 rounded-lg border border-warning/40 bg-warning/5 p-3"
        >
          <p class="flex items-center gap-1.5 text-xs font-medium text-warning">
            <UIcon
              name="i-lucide-triangle-alert"
              class="size-3.5"
            />
            人・専門家への確認が必要な事項
          </p>
          <ul class="mt-1 list-disc space-y-0.5 ps-4 text-sm text-toned">
            <li
              v-for="item in report.humanEscalation"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>
      </section>

      <!-- 類似事例（REQUIREMENT §7.9 / §7.12） -->
      <section>
        <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-highlighted">
          <UIcon
            name="i-lucide-files"
            class="size-4"
          />
          類似事例
        </h3>
        <ChatToolCaseMatchList :result="report.similarCases" />
      </section>

      <!-- 社内初動ガイド（REQUIREMENT §7.10 / §7.12） -->
      <section>
        <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-highlighted">
          <UIcon
            name="i-lucide-book-open-check"
            class="size-4"
          />
          社内初動ガイド
        </h3>
        <ChatToolGuideMatchList :result="report.guides" />
      </section>

      <!-- 有識者候補（REQUIREMENT §7.11 / §7.15） -->
      <section>
        <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-highlighted">
          <UIcon
            name="i-lucide-users"
            class="size-4"
          />
          有識者候補
        </h3>
        <ChatToolExpertMatchList
          :result="report.experts"
          :can-respond="canRespond"
          @draft-request="requestDraft"
        />
      </section>

      <!-- 次の確認質問 -->
      <section
        v-if="report.followUpQuestion"
        class="rounded-lg bg-elevated p-3"
      >
        <p class="flex items-center gap-1.5 text-xs font-medium text-muted">
          <UIcon
            name="i-lucide-message-circle-question-mark"
            class="size-3.5"
          />
          次に確認したいこと
        </p>
        <p class="mt-1 text-sm text-toned">
          {{ report.followUpQuestion }}
        </p>
      </section>
    </div>
  </div>
</template>
