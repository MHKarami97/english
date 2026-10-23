<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Flame } from '@lucide/vue';
import type { TodaySummary } from '@/application/TodayService';

defineProps<{ summary: TodaySummary }>();

const formatTime = (seconds: number): string => (seconds < 60 ? 'under 1 min' : `${Math.round(seconds / 60)} min`);
</script>

<template>
  <section class="card p-5 md:p-6" aria-labelledby="today-title">
    <h2 id="today-title" class="text-sm font-medium text-muted">Today</h2>

    <template v-if="summary.plannedTotal > 0">
      <p class="mt-1 font-display text-title font-semibold">
        {{ summary.plannedTotal }} {{ summary.plannedTotal === 1 ? 'card' : 'cards' }} to study
      </p>
      <dl class="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt class="text-muted">New</dt>
          <dd class="font-medium tabular-nums" data-test="new">{{ summary.newAvailable }}</dd>
        </div>
        <div>
          <dt class="text-muted">Due</dt>
          <dd class="font-medium tabular-nums" data-test="due">{{ summary.reviewsPlanned }}</dd>
        </div>
        <div>
          <dt class="text-muted">About</dt>
          <dd class="font-medium" data-test="time">{{ formatTime(summary.estimatedSeconds) }}</dd>
        </div>
      </dl>
      <RouterLink class="btn btn-primary mt-5 w-full md:w-auto" :to="{ name: 'review' }">Start review</RouterLink>
    </template>

    <template v-else>
      <p class="mt-1 font-display text-title font-semibold">
        {{ summary.studiedToday > 0 ? 'All done for today' : 'Nothing to study yet' }}
      </p>
      <p class="mt-1 text-muted">
        {{
          summary.studiedToday > 0
            ? 'Your next cards will show up when they are due.'
            : 'Pick a unit in the Library, or raise the number of new words per day in Settings.'
        }}
      </p>
    </template>

    <p class="mt-4 flex items-center gap-2 text-sm" data-test="streak">
      <Flame class="size-4 text-accent" aria-hidden="true" />
      {{ summary.streak.current }}-day streak
      <span class="text-muted">(best {{ summary.streak.longest }})</span>
    </p>
    <slot name="footer" />
  </section>
</template>
