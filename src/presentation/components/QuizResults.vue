<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Star } from '@lucide/vue';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import type { QuizSummary } from '@/application/QuizSessionService';

const props = defineProps<{ summary: QuizSummary }>();
const emit = defineEmits<{ again: []; reviewMistakes: [] }>();
const { t } = useI18n();
const favorites = ref(new Set<string>());
const time = computed(() => { const seconds = Math.round(props.summary.durationMs / 1000); return seconds < 60 ? t('review.durationSec', { n: seconds }) : t('review.durationMin', { n: Math.floor(seconds / 60) }); });
async function toggleFavorite(word: Word): Promise<void> { const state = await container.progress.toggleFavorite(word); const next = new Set(favorites.value); if (state.isFavorite) next.add(word.id); else next.delete(word.id); favorites.value = next; }
</script>

<template>
  <section class="mx-auto w-full max-w-md py-6" aria-labelledby="results-title">
    <h2 id="results-title" class="text-center font-display text-title font-semibold">{{ t('quiz.results.title') }}</h2>
    <p class="mt-1 text-center text-muted">{{ t('quiz.results.summary', { correct: summary.correct, total: summary.total, percent: Math.round(summary.accuracy * 100), time }) }}</p>
    <p v-if="summary.bestStreak >= 2" class="mt-1 text-center text-sm">{{ t('quiz.results.bestStreak', { n: summary.bestStreak }) }}</p>
    <p v-if="summary.skippedAudio > 0" class="mt-3 text-center text-sm text-muted" role="note">{{ t('quiz.results.skippedAudio', summary.skippedAudio, { n: summary.skippedAudio }) }}</p>
    <p v-if="summary.skippedImages > 0" class="mt-1 text-center text-sm text-muted" role="note">{{ t('quiz.results.skippedImages', summary.skippedImages, { n: summary.skippedImages }) }}</p>
    <section v-if="summary.missed.length" class="mt-6" aria-labelledby="missed-title">
      <h3 id="missed-title" class="mb-2 font-medium">{{ t('quiz.results.missedTitle') }}</h3>
      <ul class="card divide-y divide-line">
        <li v-for="word in summary.missed" :key="word.id" class="flex items-center gap-2 py-1 ps-4 pe-1">
          <span class="min-w-0 flex-1"><bdi class="block font-display text-lg font-semibold" lang="en" dir="ltr">{{ word.word }}</bdi><bdi class="block truncate text-sm text-muted" lang="en" dir="ltr">{{ word.definition }}</bdi></span>
          <button type="button" class="icon-btn" :aria-pressed="favorites.has(word.id)" :aria-label="favorites.has(word.id) ? t('word.removeFavorite', { word: word.word }) : t('word.addFavorite', { word: word.word })" @click="toggleFavorite(word)"><Star class="size-5" :fill="favorites.has(word.id) ? 'currentColor' : 'none'" aria-hidden="true" /></button>
        </li>
      </ul>
    </section>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <button v-if="summary.missed.length" type="button" class="btn btn-primary" @click="emit('reviewMistakes')">{{ t('quiz.results.reviewMistakes') }}</button>
      <button type="button" class="btn" @click="emit('again')">{{ t('quiz.results.again') }}</button>
      <RouterLink class="btn" :to="{ name: 'practice' }">{{ t('quiz.backToPractice') }}</RouterLink>
    </div>
  </section>
</template>
