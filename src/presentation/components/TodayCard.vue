<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Flame } from '@lucide/vue';
import type { TodaySummary } from '@/application/TodayService';

const props = defineProps<{ summary: TodaySummary }>();
const { t } = useI18n();

const estimatedTime = (): string =>
  props.summary.estimatedSeconds < 60
    ? t('card.underMinute')
    : t('card.minutes', { n: Math.round(props.summary.estimatedSeconds / 60) });

const planned = (): string => t('card.planned', { n: props.summary.plannedTotal }, props.summary.plannedTotal);
const streak = (): string => t('card.streak', { n: props.summary.streak.current }, props.summary.streak.current);
const best = (): string => t('card.best', { n: props.summary.streak.longest });
</script>

<template>
  <section class="card p-5 md:p-6" aria-labelledby="today-title">
    <h2 id="today-title" class="text-sm font-medium text-muted">{{ t('card.today') }}</h2>

    <template v-if="summary.plannedTotal > 0">
      <p class="mt-1 font-display text-title font-semibold">{{ planned() }}</p>
      <dl class="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt class="text-muted">{{ t('card.new') }}</dt>
          <dd class="font-medium tabular-nums" data-test="new">{{ summary.newAvailable }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('card.due') }}</dt>
          <dd class="font-medium tabular-nums" data-test="due">{{ summary.reviewsPlanned }}</dd>
        </div>
        <div>
          <dt class="text-muted">{{ t('card.about') }}</dt>
          <dd class="font-medium" data-test="time">{{ estimatedTime() }}</dd>
        </div>
      </dl>
      <RouterLink class="btn btn-primary mt-5 w-full md:w-auto" :to="{ name: 'review' }">{{ t('card.startReview') }}</RouterLink>
    </template>

    <template v-else>
      <p class="mt-1 font-display text-title font-semibold">
        {{ summary.studiedToday > 0 ? t('card.allDone') : t('card.nothingYet') }}
      </p>
      <p class="mt-1 text-muted">
        {{ summary.studiedToday > 0 ? t('card.allDoneBody') : t('card.nothingYetBody') }}
      </p>
    </template>

    <p class="mt-4 flex items-center gap-2 text-sm" data-test="streak">
      <Flame class="size-4 text-accent" aria-hidden="true" />
      {{ streak() }}
      <span class="text-muted">({{ best() }})</span>
    </p>
    <slot name="footer" />
  </section>
</template>
