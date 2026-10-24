<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Flame } from '@lucide/vue';
import type { SessionSummary } from '@/application/StudySessionService';
import type { StreakResult } from '@/domain/study/StreakCalculator';

const props = defineProps<{ summary: SessionSummary; streak: StreakResult | null; canUndo: boolean }>();
const emit = defineEmits<{ undo: []; more: [] }>();
const { t, locale } = useI18n();

const duration = computed(() => {
  const seconds = Math.round(props.summary.durationMs / 1000);
  return seconds < 60 ? t('review.durationSec', { n: seconds }) : t('review.durationMin', { n: Math.round(seconds / 60) });
});
const headline = computed(() =>
  t(
    'review.answered',
    { n: props.summary.answered, time: duration.value, percent: Math.round(props.summary.accuracy * 100) },
    props.summary.answered,
  ),
);
const nextDue = computed(() =>
  props.summary.nextDueAt === null
    ? t('review.noNext')
    : new Date(props.summary.nextDueAt).toLocaleDateString(locale.value, { weekday: 'long', month: 'short', day: 'numeric' }),
);
const rows = computed(() => [
  { key: 'again', value: props.summary.byRating.again },
  { key: 'hard', value: props.summary.byRating.hard },
  { key: 'good', value: props.summary.byRating.good },
  { key: 'easy', value: props.summary.byRating.easy },
]);
</script>

<template>
  <section class="mx-auto w-full max-w-md py-6 text-center" aria-labelledby="summary-title">
    <h2 id="summary-title" class="font-display text-title font-semibold">{{ t('review.complete') }}</h2>
    <p class="mt-1 text-muted">{{ headline }}</p>

    <dl class="mt-6 grid grid-cols-4 gap-2 text-sm">
      <div v-for="row in rows" :key="row.key" class="card px-2 py-3">
        <dt class="text-muted">{{ t(`review.${row.key}`) }}</dt>
        <dd class="font-display text-xl font-semibold tabular-nums">{{ row.value }}</dd>
      </div>
    </dl>

    <p class="mt-6"><span class="text-muted">{{ t('review.nextCards') }}</span> {{ nextDue }}</p>
    <p v-if="streak" class="mt-2 flex items-center justify-center gap-2">
      <Flame class="size-4 text-accent" aria-hidden="true" />
      {{ t('card.streak', { n: streak.current }, streak.current) }}
    </p>

    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <RouterLink class="btn btn-primary" :to="{ name: 'today' }">{{ t('review.backToday') }}</RouterLink>
      <button type="button" class="btn" @click="emit('more')">{{ t('review.more') }}</button>
      <button v-if="canUndo" type="button" class="btn" @click="emit('undo')">{{ t('review.undoLast') }}</button>
    </div>
  </section>
</template>
