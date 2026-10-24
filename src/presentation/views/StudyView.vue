<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, RotateCw, Star, X } from '@lucide/vue';
import { container } from '@/container';
import FlashCard from '@/presentation/components/FlashCard.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useAudio } from '@/presentation/composables/useAudio';
import { useUnitTitle } from '@/presentation/composables/useUnitTitle';
import { useBooksStore } from '@/presentation/stores/books';
import { useStudyStore } from '@/presentation/stores/study';

const { t } = useI18n();
const unitTitle = useUnitTitle();
const route = useRoute();
const books = useBooksStore();
const study = useStudyStore();
const audio = useAudio();

const flashCard = ref<InstanceType<typeof FlashCard> | null>(null);

const total = computed(() => study.words.length);
const audioUrl = computed(() => (study.current ? container.media.audio(study.current) : null));
const audioFailed = computed(() => audioUrl.value !== null && audio.state.value.url === audioUrl.value && audio.state.value.status === 'error');
const isFavorite = computed(() => study.currentState?.isFavorite === true);
const isFavoritesRoute = computed(() => route.name === 'study-favorites');
const backTarget = computed(() => (isFavoritesRoute.value ? { name: 'favorites' } : { name: 'unit', params: { unitId: String(route.params.unitId) } }));

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
  <section class="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-8" aria-labelledby="study-title">
    <header class="flex items-center gap-2">
      <RouterLink class="icon-btn" :to="backTarget" :aria-label="t('study.back')"><ArrowLeft class="size-5 rtl:-scale-x-100" aria-hidden="true" /></RouterLink>
      <div class="min-w-0 flex-1">
        <h1 id="study-title" class="truncate text-sm font-medium text-muted">{{ unitTitle(study.title) }}</h1>
        <p v-if="study.status === 'ready'" class="text-sm tabular-nums" aria-live="polite">{{ t('study.cardOf', { current: study.index + 1, total }) }}</p>
      </div>
      <button type="button" class="icon-btn" :aria-pressed="isFavorite" :aria-label="isFavorite ? t('study.removeFavorite') : t('study.addFavorite')" :disabled="!study.current" @click="study.toggleFavorite()">
        <Star class="size-5" :fill="isFavorite ? 'currentColor' : 'none'" aria-hidden="true" />
      </button>
    </header>

    <div v-if="study.status === 'ready'" class="bar mt-2" role="progressbar" :aria-label="t('study.progressSet')" :aria-valuenow="study.index + 1" aria-valuemin="1" :aria-valuemax="total">
      <span :style="{ inlineSize: `${((study.index + 1) / total) * 100}%` }" />
    </div>

    <div v-if="study.status === 'loading'" class="mt-6 flex-1" aria-hidden="true">
      <div class="skeleton h-[clamp(20rem,54dvh,34rem)] w-full rounded-2xl" />
    </div>
    <StateMessage v-else-if="study.status === 'empty'" kind="empty" :title="isFavoritesRoute ? t('study.favoritesEmpty') : t('study.unitEmpty')" :body="isFavoritesRoute ? t('study.favoritesEmptyBody') : t('study.unitEmptyBody')" />
    <StateMessage v-else-if="study.status === 'error'" kind="error" :title="t('study.openError')" :body="t('study.openErrorBody')" />

    <div v-else-if="study.finished" class="flex flex-1 flex-col items-center justify-center text-center">
      <h2 class="font-display text-title font-semibold">{{ t('study.endTitle') }}</h2>
      <p class="mt-2 text-muted">{{ t('study.endBody', { known: study.knownCount, total }) }}</p>
      <div class="mt-6 flex gap-3">
        <button type="button" class="btn" @click="study.restart()">{{ t('study.restart') }}</button>
        <RouterLink class="btn btn-primary" :to="backTarget">{{ t('study.backList') }}</RouterLink>
      </div>
    </div>

    <template v-else-if="study.current">
      <div class="flex min-w-0 flex-1 flex-col justify-center py-3">
        <FlashCard ref="flashCard" :word="study.current" :flipped="study.flipped" :swipeable="true" :audio-failed="audioFailed" @flip="study.flip()" @play="study.playCurrent()" @swipe="study.mark($event)" />
        <p class="mt-3 hidden text-center text-sm text-muted md:block">{{ t('study.hints') }}</p>
      </div>

      <div class="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
        <button type="button" class="icon-btn" :aria-label="t('study.previous')" :disabled="study.index === 0" @click="study.goTo(study.index - 1)">
          <ChevronLeft class="size-6 rtl:-scale-x-100" aria-hidden="true" />
        </button>
        <button type="button" class="btn min-w-0 px-2 text-sm" @click="study.mark('unknown'); refocus($event)">
          <X class="size-5 shrink-0 text-unknown" aria-hidden="true" />
          <span class="truncate">{{ t('study.unknown') }}</span>
        </button>
        <button type="button" class="btn min-w-0 px-2 text-sm" @click="study.flip()">
          <RotateCw class="size-5 shrink-0" aria-hidden="true" />
          <span class="sr-only">{{ t('study.flip') }}</span>
        </button>
        <button type="button" class="btn btn-primary min-w-0 px-2 text-sm" @click="study.mark('known'); refocus($event)">
          <Check class="size-5 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ t('study.known') }}</span>
        </button>
        <button type="button" class="icon-btn" :aria-label="t('study.next')" :disabled="study.index >= total - 1" @click="study.goTo(study.index + 1)">
          <ChevronRight class="size-6 rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </div>
    </template>
  </section>
</template>
