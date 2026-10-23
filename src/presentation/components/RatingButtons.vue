<script setup lang="ts">
import { formatInterval } from '@/domain/scheduling/formatInterval';
import { RATINGS, type Interval, type Rating } from '@/domain/scheduling/types';

defineProps<{ preview: Record<Rating, Interval> | null }>();
const emit = defineEmits<{ rate: [rating: Rating] }>();

const labels: Record<Rating, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const accents: Record<Rating, string> = {
  again: 'border-t-unknown',
  hard: 'border-t-fav',
  good: 'border-t-accent',
  easy: 'border-t-known',
};
</script>

<template>
  <div class="grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember this word?">
    <button
      v-for="(rating, position) in RATINGS"
      :key="rating"
      type="button"
      class="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-t-4 border-line bg-surface px-1 py-2 transition-colors hover:border-muted"
      :class="accents[rating]"
      :data-rating="rating"
      :aria-keyshortcuts="String(position + 1)"
      @click="emit('rate', rating)"
    >
      <span class="font-medium">{{ labels[rating] }}</span>
      <span v-if="preview" class="text-xs text-muted tabular-nums">{{ formatInterval(preview[rating].days) }}</span>
    </button>
  </div>
</template>
