<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { I18nT, useI18n } from 'vue-i18n';
import { ArrowRight } from '@lucide/vue';
import { APP_NAME } from '@/config/app';
import { container } from '@/container';
import MediaImage from '@/presentation/components/MediaImage.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import TodayCard from '@/presentation/components/TodayCard.vue';
import { useUnitTitle } from '@/presentation/composables/useUnitTitle';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { useTodayStore } from '@/presentation/stores/today';

const { t } = useI18n();
const unitTitle = useUnitTitle();
const books = useBooksStore();
const catalog = useCatalogStore();
const today = useTodayStore();
const previewUnits = computed(() => catalog.snapshot?.units.slice(0, 8) ?? []);

onMounted(async () => {
  const bookId = books.activeBookId;
  if (bookId) await Promise.all([catalog.load(bookId), catalog.loadContinue(bookId), today.load(bookId)]);
});
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
    <header class="mb-6">
      <h1 class="font-display text-title font-semibold">{{ APP_NAME }}</h1>
      <p class="text-muted">
        <bdi lang="en">{{ books.activeBook?.title }}</bdi>
      </p>
    </header>

    <StateMessage
      v-if="catalog.status === 'error' || today.status === 'error'"
      kind="error"
      :title="t('home.loadErrorTitle')"
      :body="t('home.loadErrorBody')"
    />

    <div v-else class="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
      <div>
        <TodayCard v-if="today.summary" :summary="today.summary" />
        <div v-else class="card p-6" aria-hidden="true">
          <div class="skeleton h-4 w-16" />
          <div class="skeleton mt-3 h-8 w-2/3" />
          <div class="skeleton mt-6 h-11 w-40" />
        </div>

        <section v-if="catalog.continueTarget" aria-labelledby="continue-title" class="card mt-4 flex items-center gap-4 p-3">
          <MediaImage class="size-16 shrink-0 rounded-md" :src="container.media.unitImage(catalog.continueTarget.unit)" :width="64" :height="64" />
          <div class="min-w-0 flex-1">
            <h2 id="continue-title" class="text-sm font-medium text-muted">{{ t('home.continueTitle') }}</h2>
            <p class="truncate font-medium">{{ unitTitle(catalog.continueTarget.unit.title) }}</p>
            <I18nT keypath="home.lastCard" tag="p" scope="global" class="truncate text-sm text-muted">
              <template #word>
                <bdi lang="en" dir="ltr">{{ catalog.continueTarget.word.word }}</bdi>
              </template>
            </I18nT>
          </div>
          <RouterLink
            class="icon-btn text-accent"
            :aria-label="t('home.resume')"
            :to="{ name: 'study-unit', params: { unitId: catalog.continueTarget.unit.id }, query: { word: catalog.continueTarget.word.id } }"
          >
            <ArrowRight class="size-5 rtl:-scale-x-100" aria-hidden="true" />
          </RouterLink>
        </section>

        <dl v-if="catalog.snapshot" class="mt-6 flex gap-10">
          <div>
            <dt class="text-sm text-muted">{{ t('home.totalWords') }}</dt>
            <dd class="font-display text-title font-semibold tabular-nums">{{ catalog.snapshot.totalWords }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">{{ t('home.knownWords') }}</dt>
            <dd class="font-display text-title font-semibold text-known tabular-nums">{{ catalog.snapshot.knownWords }}</dd>
          </div>
        </dl>
      </div>

      <section aria-labelledby="units-title" class="mt-8 lg:mt-0">
        <div class="mb-3 flex items-baseline justify-between">
          <h2 id="units-title" class="font-display text-xl font-semibold">{{ t('home.units') }}</h2>
          <RouterLink v-if="books.activeBookId" class="text-sm text-accent underline underline-offset-4" :to="{ name: 'units', params: { bookId: books.activeBookId } }">
            {{ t('home.allUnits') }}
          </RouterLink>
        </div>
        <ul v-if="previewUnits.length" class="divide-y divide-line border-y border-line">
          <li v-for="summary in previewUnits" :key="summary.unit.id">
            <RouterLink class="flex min-h-11 items-center justify-between gap-3 py-2" :to="{ name: 'unit', params: { unitId: summary.unit.id } }">
              <span class="truncate">{{ unitTitle(summary.unit.title) }}</span>
              <span class="shrink-0 text-sm text-muted tabular-nums">{{ summary.known }} / {{ summary.total }}</span>
            </RouterLink>
          </li>
        </ul>
        <div v-else-if="catalog.status === 'loading'" class="space-y-3" aria-hidden="true">
          <div v-for="row in 5" :key="row" class="skeleton h-8 w-full" />
        </div>
      </section>
    </div>
  </div>
</template>
