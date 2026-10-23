<script setup lang="ts">
import { computed } from 'vue';
import { CircleAlert, CircleCheck, CircleX, Volume2 } from '@lucide/vue';
import type { Word } from '@/domain/entities';
import type { Grade } from '@/domain/quiz/grading';
import ExampleSentence from './ExampleSentence.vue';

const props = defineProps<{ grade: Grade; target: Word; autoAdvance: boolean }>();
const emit = defineEmits<{ next: []; play: [] }>();

const headline = computed(() => {
  switch (props.grade.outcome) {
    case 'correct':
      return 'Correct';
    case 'almost':
      return 'Almost. Check the spelling.';
    case 'close-form':
      return 'Close. Check the form of the word.';
    default:
      return 'Not quite';
  }
});
const tone = computed(() => (props.grade.outcome === 'wrong' ? 'border-unknown' : props.grade.outcome === 'correct' ? 'border-known' : 'border-fav'));
</script>

<template>
  <div class="card mt-4 border-2 p-4" :class="tone" role="status" aria-live="polite">
    <p class="flex items-center gap-2 font-medium">
      <CircleCheck v-if="grade.outcome === 'correct'" class="size-5 text-known" aria-hidden="true" />
      <CircleAlert v-else-if="grade.almost" class="size-5 text-fav" aria-hidden="true" />
      <CircleX v-else class="size-5 text-unknown" aria-hidden="true" />
      {{ headline }}
    </p>
    <p v-if="grade.outcome !== 'correct'" class="mt-2">The answer is <strong class="font-semibold">{{ grade.expected }}</strong>.</p>
    <ExampleSentence class="mt-3 text-muted" :segments="target.exampleSegments" />
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" class="btn" @click="emit('play')"><Volume2 class="size-5" aria-hidden="true" /> Play</button>
      <button type="button" class="btn btn-primary" @click="emit('next')">Next</button>
      <span class="text-sm text-muted">Press Enter to continue<template v-if="autoAdvance && grade.correct">, or wait a moment</template>.</span>
    </div>
  </div>
</template>
