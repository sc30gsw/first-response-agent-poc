<script setup lang="ts">
import type { MatchReason, SimilarCaseSearchResult } from "~~/shared/tools/first-response";

defineProps<{
  result: SimilarCaseSearchResult;
}>();

function matchedTerms(reasons: MatchReason[]): string[] {
  return [...new Set(reasons.flatMap((reason) => reason.matched))];
}
</script>

<template>
  <p
    v-if="!result.hasSufficientEvidence"
    class="text-sm text-muted"
  >
    十分な根拠なし — 該当する類似事例が見つかりませんでした。
  </p>

  <div
    v-else
    class="space-y-3"
  >
    <div
      v-for="match in result.matches"
      :key="match.case.id"
      class="rounded-lg border border-default p-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          size="sm"
          color="neutral"
          variant="subtle"
        >
          {{ match.case.id }}
        </UBadge>
        <span class="text-xs text-dimmed">一致スコア {{ match.score }}</span>
      </div>

      <p class="mt-2 text-sm font-medium text-highlighted">
        {{ match.case.summary }}
      </p>

      <dl class="mt-2 space-y-1 text-xs">
        <div>
          <dt class="inline font-medium text-muted">
            初動対応:
          </dt>
          <dd class="inline text-toned">
            {{ match.case.initialResponse }}
          </dd>
        </div>
        <div>
          <dt class="inline font-medium text-muted">
            結果:
          </dt>
          <dd class="inline text-toned">
            {{ match.case.outcome }}
          </dd>
        </div>
        <div>
          <dt class="inline font-medium text-muted">
            注意点:
          </dt>
          <dd class="inline text-warning">
            {{ match.case.cautions }}
          </dd>
        </div>
      </dl>

      <div
        v-if="matchedTerms(match.reasons).length"
        class="mt-2 flex flex-wrap items-center gap-1"
      >
        <span class="text-xs text-dimmed">一致項目:</span>
        <UBadge
          v-for="term in matchedTerms(match.reasons)"
          :key="term"
          size="sm"
          color="neutral"
          variant="outline"
        >
          {{ term }}
        </UBadge>
      </div>
    </div>
  </div>
</template>
