<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, RotateCw, Star, X } from '@lucide/vue';
import { container } from '@/container';
import FlashCard from '@/presentation/components/FlashCard.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useAudio } from '@/presentation/composables/useAudio';
import { useBooksStore } from '@/presentation/stores/books';
import { useStudyStore } from '@/presentation/stores/study';

const route = useRoute();
const books = useBooksStore();
const study = useStudyStore();
const audio = useAudio();

const flashCard = ref<InstanceType<typeof FlashCard> | null>(null);

const total = computed(() => study.words.length);
const audioUrl = computed(() => (study.current ? container.media.audio(study.current) : null));
const audioFailed = computed(() => audioUrl.value !== null && audio.state.value.url === audioUrl.value && audio.state.value.status === 'error');
const isFavorite = computed(() => study.currentState?.isFavorite === true);
const backTarget = computed(() => (route.name === 'study-favorites' ? { name: 'favorites' } : { name: 'unit', params: { unitId: String(route.params.unitId) } }));

onMounted(async () => {
  const startWordId = typeof route.query.word === 'string' ? route.query.word : undefined;
  window.addEventListener('keydown', onKeydown);
  if (route.name === 'study-favorites' && books.activeBookId) {
    const bookId = books.activeBookId;
    await study.open(() => container.study.loadFavorites(bookId), startWordId);
  } else {
    const unitId = String(route.params.unitId);
    await study.open(() => container.study.loadUnit(unitId), startWordId);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  study.leave();
});

function refocus(event: MouseEvent): void {
  // Keeps Space bound to "flip" after a pointer click left focus on an action button.
  if (event.detail > 0) flashCard.value?.focus();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
  switch (event.code) {
    case 'Space':
      if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
      event.preventDefault();
      study.flip();
      break;
    case 'ArrowLeft':
      study.goTo(study.index - 1);
      break;
    case 'ArrowRight':
      study.goTo(study.index + 1);
      break;
    case 'KeyP':
      study.playCurrent();
      break;
    case 'KeyF':
      void study.toggleFavorite();
      break;
  }
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8" aria-labelledby="study-title">
    <header class="flex items-center gap-2">
      <RouterLink class="icon-btn" :to="backTarget" aria-label="Back"><ArrowLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" /></RouterLink>
      <div class="min-w-0 flex-1">
        <h1 id="study-title" class="truncate text-sm font-medium text-muted">{{ study.title }}</h1>
        <p v-if="study.status === 'ready'" class="text-sm tabular-nums" aria-live="polite">Card {{ study.index + 1 }} of {{ total }}</p>
      </div>
      <button type="button" class="icon-btn" :aria-pressed="isFavorite" :aria-label="isFavorite ? 'Remove from favorites (F)' : 'Add to favorites (F)'" :disabled="!study.current" @click="study.toggleFavorite()">
        <Star class="size-5" :fill="isFavorite ? 'currentColor' : 'none'" aria-hidden="true" />
      </button>
    </header>

    <div v-if="study.status === 'ready'" class="bar mt-2" role="progressbar" aria-label="Progress through this set" :aria-valuenow="study.index + 1" aria-valuemin="1" :aria-valuemax="total">
      <span :style="{ inlineSize: `${((study.index + 1) / total) * 100}%` }" />
    </div>

    <div v-if="study.status === 'loading'" class="mt-6 flex-1" aria-hidden="true">
      <div class="skeleton h-[clamp(22rem,58dvh,36rem)] w-full rounded-2xl" />
    </div>
    <StateMessage v-else-if="study.status === 'empty'" kind="empty" :title="route.name === 'study-favorites' ? 'No favorites yet' : 'Nothing to study here'" :body="route.name === 'study-favorites' ? 'Tap the star on a word and it will wait for you here.' : 'This unit has no words.'" />
    <StateMessage v-else-if="study.status === 'error'" kind="error" title="Could not open the cards" body="Reload the page and try again." />

    <div v-else-if="study.finished" class="flex flex-1 flex-col items-center justify-center text-center">
      <h2 class="font-display text-title font-semibold">End of the set</h2>
      <p class="mt-2 text-muted">You know {{ study.knownCount }} of {{ total }} cards in this set.</p>
      <div class="mt-6 flex gap-3">
        <button type="button" class="btn" @click="study.restart()">Start again</button>
        <RouterLink class="btn btn-primary" :to="backTarget">Back to the list</RouterLink>
      </div>
    </div>

    <template v-else-if="study.current">
      <div class="flex flex-1 flex-col justify-center py-4">
        <FlashCard
          ref="flashCard"
          :word="study.current"
          :flipped="study.flipped"
          :swipeable="true"
          :audio-failed="audioFailed"
          @flip="study.flip()"
          @play="study.playCurrent()"
          @swipe="study.mark($event)"
        />
        <p class="mt-3 hidden text-center text-sm text-muted md:block">Space flips, arrows move, P plays, F favorites.</p>
      </div>

      <div class="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2">
        <button type="button" class="icon-btn" aria-label="Previous card" :disabled="study.index === 0" @click="study.goTo(study.index - 1)"><ChevronLeft class="size-6 rtl:-scale-x-100" aria-hidden="true" /></button>
        <button type="button" class="btn" @click="study.mark('unknown'); refocus($event)"><X class="size-5 text-unknown" aria-hidden="true" /> Unknown</button>
        <button type="button" class="btn" @click="study.flip()"><RotateCw class="size-5" aria-hidden="true" /> Flip</button>
        <button type="button" class="btn btn-primary" @click="study.mark('known'); refocus($event)"><Check class="size-5" aria-hidden="true" /> Known</button>
        <button type="button" class="icon-btn" aria-label="Next card" :disabled="study.index >= total - 1" @click="study.goTo(study.index + 1)"><ChevronRight class="size-6 rtl:-scale-x-100" aria-hidden="true" /></button>
      </div>
    </template>
  </section>
</template>
