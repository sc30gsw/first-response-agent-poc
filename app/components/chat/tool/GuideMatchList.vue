<script setup lang="ts">
import type { GuideSearchResult } from "~~/shared/tools/first-response";

defineProps<{
  result: GuideSearchResult;
}>();
</script>

<template>
  <p
    v-if="!result.hasSufficientEvidence"
    class="text-sm text-muted"
  >
    十分な根拠なし — 該当する社内初動ガイドが見つかりませんでした。
  </p>

  <div
    v-else
    class="space-y-3"
  >
    <div
      v-for="match in result.matches"
      :key="match.guide.id"
      class="rounded-lg border border-default p-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          size="sm"
          color="neutral"
          variant="subtle"
        >
          {{ match.guide.id }}
        </UBadge>
        <span class="text-sm font-medium text-highlighted">{{ match.guide.title }}</span>
        <span class="text-xs text-dimmed">（{{ match.guide.area }}）</span>
      </div>

      <div class="mt-2 space-y-2 text-xs">
        <div>
          <p class="font-medium text-muted">
            確認項目
          </p>
          <ul class="mt-1 list-disc space-y-0.5 ps-4 text-toned">
            <li
              v-for="item in match.guide.checkItems"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>

        <div v-if="match.guide.cautions.length">
          <p class="font-medium text-muted">
            注意点
          </p>
          <ul class="mt-1 list-disc space-y-0.5 ps-4 text-warning">
            <li
              v-for="item in match.guide.cautions"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>

        <div v-if="match.guide.expertConsultationConditions.length">
          <p class="font-medium text-muted">
            有識者に相談すべき条件
          </p>
          <ul class="mt-1 list-disc space-y-0.5 ps-4 text-toned">
            <li
              v-for="item in match.guide.expertConsultationConditions"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
