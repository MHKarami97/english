<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, Check } from '@lucide/vue';
import { container } from '@/container';
import MediaImage from '@/presentation/components/MediaImage.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { formatClock, scopeFromQuery } from '@/presentation/practiceQuery';
import { useBooksStore } from '@/presentation/stores/books';
import { useMatchingStore } from '@/presentation/stores/matching';

const { t } = useI18n();
const route = useRoute();
const books = useBooksStore();
const matching = useMatchingStore();
const left = ref<string | null>(null);
const right = ref<string | null>(null);
const shaking = ref<string | null>(null);
const now = ref(0);
let clockTimer: ReturnType<typeof setInterval> | undefined;
let shakeTimer: ReturnType<typeof setTimeout> | undefined;

const view = computed(() => matching.view);
const question = computed(() => view.value?.question ?? null);
const variant = computed(() => (route.query.variant === 'image' ? 'image' : 'definition'));
const labels = computed(() => new Map((question.value?.pairs ?? []).map((pair) => [pair.wordId, pair])));

onMounted(async () => {
  const bookId = books.activeBookId;
  if (!bookId) return;
  await matching.start(bookId, scopeFromQuery(route.query), variant.value);
  clockTimer = setInterval(() => (now.value = view.value?.elapsedMs ?? 0), 1000);
});

onBeforeUnmount(() => {
  clearInterval(clockTimer);
  clearTimeout(shakeTimer);
});

async function choose(side: 'left' | 'right', wordId: string): Promise<void> {
  if (view.value?.status !== 'playing' || view.value.matched.has(wordId)) return;
  if (side === 'left') left.value = wordId;
  else right.value = wordId;
  if (!left.value || !right.value) return;
  const pair = { left: left.value, right: right.value };
  left.value = null;
  right.value = null;
  if (!(await matching.attempt(pair.left, pair.right))) {
    shaking.value = pair.right;
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => (shaking.value = null), 400);
  }
}

const imageFor = (wordId: string): string | null => {
  const word = view.value?.words.get(wordId);
  return word ? container.media.wordImage(word) : null;
};
</script>

<template>
  <section class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8" aria-labelledby="matching-title">
    <header class="flex items-center gap-2">
      <RouterLink class="icon-btn" :to="{ name: 'practice' }" :aria-label="t('quiz.backToPractice')"><ArrowLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" /></RouterLink>
      <div class="min-w-0 flex-1">
        <h1 id="matching-title" class="text-sm font-medium text-muted">{{ t('matching.title') }}</h1>
        <p v-if="view && view.status !== 'finished'" class="text-sm tabular-nums">{{ t('matching.status', { round: view.round, attempts: view.attempts, time: formatClock(Math.max(now, 1)) }) }}</p>
      </div>
      <button v-if="view && view.status !== 'finished'" type="button" class="btn" @click="matching.finish()">{{ t('matching.finish') }}</button>
    </header>

    <div v-if="matching.status === 'loading' || matching.status === 'idle'" class="mt-6 grid gap-3" aria-hidden="true"><div v-for="row in 6" :key="row" class="skeleton h-14 w-full" /></div>
    <StateMessage v-else-if="matching.status === 'error'" kind="error" :title="t('matching.startError')" :body="t('matching.startErrorBody')" />
    <StateMessage v-else-if="view?.empty" kind="empty" :title="t('matching.emptyTitle')" :body="t('matching.emptyBody')">
      <RouterLink class="btn btn-primary" :to="{ name: 'practice' }">{{ t('quiz.backToPractice') }}</RouterLink>
    </StateMessage>

    <section v-else-if="view?.status === 'finished'" class="mx-auto w-full max-w-md py-8 text-center">
      <h2 class="font-display text-title font-semibold">{{ t('matching.gameOver') }}</h2>
      <p class="mt-2 text-muted">{{ t('matching.summary', { pairs: view.pairsMatched, attempts: view.attempts, rounds: view.round }, view.round) }}</p>
      <div class="mt-6 flex justify-center gap-3">
        <RouterLink class="btn btn-primary" :to="{ name: 'practice' }">{{ t('quiz.backToPractice') }}</RouterLink>
        <RouterLink class="btn" :to="{ name: 'mistakes' }">{{ t('matching.seeMistakes') }}</RouterLink>
      </div>
    </section>

    <template v-else-if="view && question">
      <p class="mt-4 text-sm text-muted">{{ t('matching.instruction') }}</p>
      <div class="mt-3 grid gap-6 sm:grid-cols-2">
        <ul class="space-y-3" :aria-label="t('matching.wordsList')">
          <li v-for="id in question.leftOrder" :key="id">
            <button type="button" class="flex min-h-14 w-full items-center justify-between gap-2 rounded-lg border-2 bg-surface px-4 text-start font-display text-lg font-semibold" :class="view.matched.has(id) ? 'border-known opacity-70' : left === id ? 'border-accent' : 'border-line'" :disabled="view.matched.has(id)" :aria-pressed="left === id" @click="choose('left', id)">
              <bdi lang="en" dir="ltr">{{ labels.get(id)?.label }}</bdi>
              <Check v-if="view.matched.has(id)" class="size-5 text-known" aria-hidden="true" /><span v-if="view.matched.has(id)" class="sr-only">{{ t('matching.matched') }}</span>
            </button>
          </li>
        </ul>
        <ul class="space-y-3" :aria-label="t('matching.matchesList')">
          <li v-for="id in question.rightOrder" :key="id">
            <button type="button" class="shake-target flex min-h-14 w-full items-center justify-between gap-2 rounded-lg border-2 bg-surface p-3 text-start text-sm" :class="[view.matched.has(id) ? 'border-known opacity-70' : right === id ? 'border-accent' : 'border-line', shaking === id ? 'is-shaking' : '']" :disabled="view.matched.has(id)" :aria-pressed="right === id" @click="choose('right', id)">
              <MediaImage v-if="question.variant === 'image'" class="w-full max-w-40 rounded-md" :src="imageFor(id)" :width="4" :height="3" />
              <span v-else lang="en" dir="ltr">{{ labels.get(id)?.definition }}</span>
              <Check v-if="view.matched.has(id)" class="size-5 shrink-0 text-known" aria-hidden="true" /><span v-if="view.matched.has(id)" class="sr-only">{{ t('matching.matched') }}</span>
            </button>
          </li>
        </ul>
      </div>

      <div v-if="view.status === 'round-complete'" class="card mt-6 p-4 text-center" role="status">
        <p class="font-medium">{{ t('matching.roundDone', { round: view.round, tries: view.roundAttempts }) }}</p>
        <button type="button" class="btn btn-primary mt-3" @click="matching.nextRound()">{{ t('matching.nextRound') }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .is-shaking {
    animation: shake 300ms ease-out;
  }
}
@keyframes shake {
  20% { transform: translateX(-6px); }
  50% { transform: translateX(5px); }
  80% { transform: translateX(-3px); }
}
</style>
