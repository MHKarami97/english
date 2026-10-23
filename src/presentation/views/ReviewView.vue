<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ArrowLeft, Undo2 } from '@lucide/vue';
import { container } from '@/container';
import type { Rating } from '@/domain/scheduling/types';
import ConfirmDialog from '@/presentation/components/ConfirmDialog.vue';
import FlashCard from '@/presentation/components/FlashCard.vue';
import RatingButtons from '@/presentation/components/RatingButtons.vue';
import ReviewSummary from '@/presentation/components/ReviewSummary.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useAudio } from '@/presentation/composables/useAudio';
import { useBooksStore } from '@/presentation/stores/books';
import { useReviewStore } from '@/presentation/stores/review';

const EXTRA_NEW_CARDS = 10;
const RATING_KEYS: Readonly<Record<string, Rating>> = {
  Digit1: 'again',
  Digit2: 'hard',
  Digit3: 'good',
  Digit4: 'easy',
  Numpad1: 'again',
  Numpad2: 'hard',
  Numpad3: 'good',
  Numpad4: 'easy',
};

const route = useRoute();
const books = useBooksStore();
const review = useReviewStore();
const audio = useAudio();
const moreDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

const view = computed(() => review.view);
const current = computed(() => view.value?.current ?? null);
const audioUrl = computed(() => (current.value ? container.media.audio(current.value.word) : null));
const audioFailed = computed(() => audioUrl.value !== null && audio.state.value.url === audioUrl.value && audio.state.value.status === 'error');
const isEmpty = computed(() => view.value?.status === 'finished' && (review.summary?.answered ?? 0) === 0);
const progress = computed(() => {
  const total = view.value?.total ?? 0;
  return total === 0 ? 0 : Math.min(100, ((total - (view.value?.remaining ?? 0)) / total) * 100);
});

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  const extra = Number(route.query.extra);
  if (books.activeBookId) await review.start(books.activeBookId, extra > 0 ? extra : undefined);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  review.leave();
});

function onKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
  const rating = RATING_KEYS[event.code];
  if (rating) {
    if (view.value?.revealed) void review.answer(rating);
    return;
  }
  switch (event.code) {
    case 'Space':
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
      event.preventDefault();
      review.reveal();
      break;
    case 'KeyU':
      void review.undo();
      break;
    case 'KeyP':
      review.playCurrent();
      break;
  }
}

function studyMore(): void {
  if (books.activeBookId) void review.start(books.activeBookId, EXTRA_NEW_CARDS);
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8" aria-labelledby="review-title">
    <header class="flex items-center gap-2">
      <RouterLink class="icon-btn" :to="{ name: 'today' }" aria-label="Back to Today"><ArrowLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" /></RouterLink>
      <div class="min-w-0 flex-1">
        <h1 id="review-title" class="text-sm font-medium text-muted">Review</h1>
        <p v-if="view && view.status === 'active'" class="text-sm tabular-nums" aria-live="polite">
          {{ view.remaining }} left<span v-if="view.resumed" class="text-muted"> (picked up where you left off)</span>
        </p>
      </div>
      <button type="button" class="icon-btn" aria-label="Undo last answer (U)" :disabled="!view?.canUndo" @click="review.undo()">
        <Undo2 class="size-5" aria-hidden="true" />
      </button>
    </header>

    <div v-if="view?.status === 'active'" class="bar mt-2" role="progressbar" aria-label="Session progress" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
      <span :style="{ inlineSize: `${progress}%` }" />
    </div>

    <div v-if="review.status === 'loading' || review.status === 'idle'" class="mt-6 flex-1" aria-hidden="true">
      <div class="skeleton h-[clamp(22rem,58dvh,36rem)] w-full rounded-2xl" />
    </div>
    <StateMessage v-else-if="review.status === 'error'" kind="error" title="Could not start the review" body="Your cards could not be read. Reload the page and try again." />
    <StateMessage v-else-if="isEmpty" kind="empty" title="All done for today" body="No cards are due right now. Come back tomorrow, or study a few extra new words.">
      <RouterLink class="btn btn-primary" :to="{ name: 'today' }">Back to Today</RouterLink>
      <button type="button" class="btn" @click="moreDialog?.open()">Study more</button>
    </StateMessage>
    <ReviewSummary v-else-if="view?.status === 'finished' && review.summary" :summary="review.summary" :streak="review.streak" :can-undo="view.canUndo" @undo="review.undo()" @more="moreDialog?.open()" />

    <template v-else-if="view && current">
      <div class="flex flex-1 flex-col justify-center py-4">
        <FlashCard
          :word="current.word"
          :flipped="view.revealed"
          :swipeable="false"
          :audio-failed="audioFailed"
          @flip="review.reveal()"
          @play="review.playCurrent()"
        />
        <p class="mt-3 hidden text-center text-sm text-muted md:block">Space shows the answer, 1 to 4 rates it, U undoes, P plays.</p>
      </div>
      <RatingButtons v-if="view.revealed" :preview="view.preview" @rate="review.answer($event)" />
      <button v-else type="button" class="btn btn-primary min-h-16 w-full text-lg" @click="review.reveal()">Show answer</button>
    </template>

    <ConfirmDialog ref="moreDialog" title="Study more new words?" :body="`This adds ${EXTRA_NEW_CARDS} new words beyond your daily limit.`" confirm-label="Add them" @confirm="studyMore" />
  </section>
</template>
