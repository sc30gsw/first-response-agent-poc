<script setup lang="ts">
import type { Expert, ExpertSearchResult } from "~~/shared/tools/first-response";
import { CASE_CATEGORY_LABELS } from "~~/shared/tools/first-response";

defineProps<{
  result: ExpertSearchResult;
  canRespond?: boolean;
}>();

const emit = defineEmits<{
  draftRequest: [expert: Expert];
}>();
</script>

<template>
  <p
    v-if="!result.hasSufficientEvidence"
    class="text-sm text-muted"
  >
    十分な根拠なし — 該当する有識者候補が見つかりませんでした。
  </p>

  <div
    v-else
    class="space-y-3"
  >
    <div
      v-for="match in result.matches"
      :key="match.expert.id"
      class="rounded-lg border border-default p-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          size="sm"
          color="neutral"
          variant="subtle"
        >
          {{ match.expert.id }}
        </UBadge>
        <span class="text-sm font-medium text-highlighted">{{ match.expert.name }}</span>
        <span class="text-xs text-dimmed">{{ match.expert.department }}</span>
        <span class="text-xs text-dimmed">関連案件 {{ match.expert.relatedCaseCount }}件</span>
      </div>

      <div class="mt-2 flex flex-wrap gap-1">
        <UBadge
          v-for="specialty in match.expert.specialties"
          :key="specialty"
          size="sm"
          color="primary"
          variant="subtle"
        >
          {{ CASE_CATEGORY_LABELS[specialty] }}
        </UBadge>
        <UBadge
          v-for="strength in match.expert.strengths"
          :key="strength"
          size="sm"
          color="neutral"
          variant="outline"
        >
          {{ strength }}
        </UBadge>
      </div>

      <p class="mt-2 text-xs text-toned">
        {{ match.recommendation }}
      </p>

      <UButton
        class="mt-3"
        size="xs"
        color="primary"
        variant="soft"
        icon="i-lucide-pen-line"
        :disabled="!(canRespond ?? true)"
        @click="emit('draftRequest', match.expert)"
      >
        この人への相談文を作成
      </UButton>
    </div>
  </div>
</template>
