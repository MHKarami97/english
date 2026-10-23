<script setup lang="ts">
import { computed } from 'vue';
import type { DayActivity } from '@/application/TodayService';

const props = defineProps<{ week: readonly DayActivity[] }>();

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
const days = computed(() => {
  const peak = Math.max(1, ...props.week.map((day) => day.count));
  return props.week.map((day) => ({
    ...day,
    label: weekday.format(new Date(`${day.dateKey}T12:00:00Z`)),
    height: day.count === 0 ? 4 : Math.max(8, Math.round((day.count / peak) * 40)),
  }));
});
const description = computed(() => days.value.map((day) => `${day.label} ${day.count}`).join(', '));
</script>

<template>
  <figure class="m-0">
    <div class="flex items-end justify-between gap-2" role="img" :aria-label="`Cards studied in the last seven days: ${description}`">
      <div v-for="day in days" :key="day.dateKey" class="flex flex-1 flex-col items-center gap-1">
        <div class="w-full max-w-8 rounded-sm" :class="day.count > 0 ? 'bg-accent' : 'bg-line'" :style="{ blockSize: `${day.height}px` }" />
        <span class="text-xs text-muted" aria-hidden="true">{{ day.label }}</span>
      </div>
    </div>
  </figure>
</template>
