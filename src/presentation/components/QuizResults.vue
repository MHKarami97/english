<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { Star } from '@lucide/vue';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import type { QuizSummary } from '@/application/QuizSessionService';

const props = defineProps<{ summary: QuizSummary }>();
const emit = defineEmits<{ again: []; reviewMistakes: [] }>();

const favorites = ref(new Set<string>());
const time = computed(() => {
  const seconds = Math.round(props.summary.durationMs / 1000);
  return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
});

async function toggleFavorite(word: Word): Promise<void> {
  const state = await container.progress.toggleFavorite(word);
  const next = new Set(favorites.value);
  if (state.isFavorite) next.add(word.id);
  else next.delete(word.id);
  favorites.value = next;
}
</script>

<template>
  <section class="mx-auto w-full max-w-md py-6" aria-labelledby="results-title">
    <h2 id="results-title" class="text-center font-display text-title font-semibold">Practice complete</h2>
    <p class="mt-1 text-center text-muted">
      {{ summary.correct }} of {{ summary.total }} correct, {{ Math.round(summary.accuracy * 100) }}%, in {{ time }}.
    </p>
    <p v-if="summary.bestStreak >= 2" class="mt-1 text-center text-sm">Best streak: {{ summary.bestStreak }} in a row.</p>
    <p v-if="summary.skippedAudio > 0" class="mt-3 text-center text-sm text-muted" role="note">
      {{ summary.skippedAudio }} audio {{ summary.skippedAudio === 1 ? 'question was' : 'questions were' }} skipped because the audio is not available offline.
    </p>
    <p v-if="summary.skippedImages > 0" class="mt-1 text-center text-sm text-muted" role="note">
      {{ summary.skippedImages }} picture {{ summary.skippedImages === 1 ? 'question was' : 'questions were' }} skipped because the pictures are not available offline.
    </p>

    <section v-if="summary.missed.length" class="mt-6" aria-labelledby="missed-title">
      <h3 id="missed-title" class="mb-2 font-medium">Words to look at again</h3>
      <ul class="card divide-y divide-line">
        <li v-for="word in summary.missed" :key="word.id" class="flex items-center gap-2 py-1 ps-4 pe-1">
          <span class="min-w-0 flex-1">
            <span class="block font-display text-lg font-semibold">{{ word.word }}</span>
            <span class="block truncate text-sm text-muted">{{ word.definition }}</span>
          </span>
          <button type="button" class="icon-btn" :aria-pressed="favorites.has(word.id)" :aria-label="favorites.has(word.id) ? `Remove ${word.word} from favorites` : `Add ${word.word} to favorites`" @click="toggleFavorite(word)">
            <Star class="size-5" :fill="favorites.has(word.id) ? 'currentColor' : 'none'" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>

    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <button v-if="summary.missed.length" type="button" class="btn btn-primary" @click="emit('reviewMistakes')">Review mistakes now</button>
      <button type="button" class="btn" @click="emit('again')">Practice again</button>
      <RouterLink class="btn" :to="{ name: 'practice' }">Back to Practice</RouterLink>
    </div>
  </section>
</template>
