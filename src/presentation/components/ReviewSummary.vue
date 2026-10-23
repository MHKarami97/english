<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Flame } from '@lucide/vue';
import type { SessionSummary } from '@/application/StudySessionService';
import type { StreakResult } from '@/domain/study/StreakCalculator';

const props = defineProps<{ summary: SessionSummary; streak: StreakResult | null; canUndo: boolean }>();
const emit = defineEmits<{ undo: []; more: [] }>();

const minutes = computed(() => {
  const seconds = Math.round(props.summary.durationMs / 1000);
  return seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`;
});
const nextDue = computed(() =>
  props.summary.nextDueAt === null
    ? 'No other cards are scheduled yet.'
    : new Date(props.summary.nextDueAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
);
const rows = computed(() => [
  { label: 'Again', value: props.summary.byRating.again },
  { label: 'Hard', value: props.summary.byRating.hard },
  { label: 'Good', value: props.summary.byRating.good },
  { label: 'Easy', value: props.summary.byRating.easy },
]);
</script>

<template>
  <section class="mx-auto w-full max-w-md py-6 text-center" aria-labelledby="summary-title">
    <h2 id="summary-title" class="font-display text-title font-semibold">Session complete</h2>
    <p class="mt-1 text-muted">
      {{ summary.answered }} {{ summary.answered === 1 ? 'card' : 'cards' }} in {{ minutes }},
      {{ Math.round(summary.accuracy * 100) }}% remembered.
    </p>

    <dl class="mt-6 grid grid-cols-4 gap-2 text-sm">
      <div v-for="row in rows" :key="row.label" class="card px-2 py-3">
        <dt class="text-muted">{{ row.label }}</dt>
        <dd class="font-display text-xl font-semibold tabular-nums">{{ row.value }}</dd>
      </div>
    </dl>

    <p class="mt-6"><span class="text-muted">Next cards:</span> {{ nextDue }}</p>
    <p v-if="streak" class="mt-2 flex items-center justify-center gap-2">
      <Flame class="size-4 text-accent" aria-hidden="true" />
      {{ streak.current }}-day streak
    </p>

    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <RouterLink class="btn btn-primary" :to="{ name: 'today' }">Back to Today</RouterLink>
      <button type="button" class="btn" @click="emit('more')">Study more</button>
      <button v-if="canUndo" type="button" class="btn" @click="emit('undo')">Undo last answer</button>
    </div>
  </section>
</template>
