<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { ArrowRight } from '@lucide/vue';
import { APP_NAME } from '@/config/app';
import { container } from '@/container';
import MediaImage from '@/presentation/components/MediaImage.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';

const books = useBooksStore();
const catalog = useCatalogStore();
const firstUnit = computed(() => catalog.snapshot?.units[0] ?? null);
const previewUnits = computed(() => catalog.snapshot?.units.slice(0, 8) ?? []);

onMounted(async () => {
  const bookId = books.activeBookId;
  if (bookId) await Promise.all([catalog.load(bookId), catalog.loadContinue(bookId)]);
});
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
    <header class="mb-6">
      <h1 class="font-display text-title font-semibold">{{ APP_NAME }}</h1>
      <p class="text-muted">{{ books.activeBook?.title }}</p>
    </header>

    <StateMessage v-if="catalog.status === 'error'" kind="error" title="Could not read your library" body="Your saved words could not be opened. Reload the page and try again." />

    <div v-else class="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
      <div>
        <section aria-labelledby="continue-title" class="card overflow-hidden">
          <div v-if="catalog.status === 'loading'" class="p-6" aria-hidden="true">
            <div class="skeleton aspect-[16/9] w-full" />
            <div class="skeleton mt-5 h-6 w-1/2" />
            <div class="skeleton mt-3 h-4 w-1/3" />
          </div>
          <template v-else-if="catalog.continueTarget">
            <MediaImage class="w-full" :src="container.media.unitImage(catalog.continueTarget.unit)" :width="16" :height="9" eager />
            <div class="p-5 md:p-6">
              <h2 id="continue-title" class="text-sm font-medium text-muted">Continue</h2>
              <p class="mt-1 font-display text-title font-semibold">{{ catalog.continueTarget.unit.title }}</p>
              <p class="text-muted">Last card: {{ catalog.continueTarget.word.word }}</p>
              <RouterLink
                class="btn btn-primary mt-5 w-full md:w-auto"
                :to="{ name: 'study-unit', params: { unitId: catalog.continueTarget.unit.id }, query: { word: catalog.continueTarget.word.id } }"
              >
                Resume this card <ArrowRight class="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </RouterLink>
            </div>
          </template>
          <div v-else class="p-5 md:p-6">
            <h2 id="continue-title" class="font-display text-title font-semibold">Start your first unit</h2>
            <p class="mt-1 text-muted">Each unit holds about twenty words with pictures and audio.</p>
            <RouterLink v-if="firstUnit" class="btn btn-primary mt-5 w-full md:w-auto" :to="{ name: 'study-unit', params: { unitId: firstUnit.unit.id } }">
              Study {{ firstUnit.unit.title }}
            </RouterLink>
          </div>
        </section>

        <dl v-if="catalog.snapshot" class="mt-6 flex gap-10">
          <div>
            <dt class="text-sm text-muted">Total words</dt>
            <dd class="font-display text-title font-semibold tabular-nums">{{ catalog.snapshot.totalWords }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Known words</dt>
            <dd class="font-display text-title font-semibold text-known tabular-nums">{{ catalog.snapshot.knownWords }}</dd>
          </div>
        </dl>
      </div>

      <section aria-labelledby="units-title" class="mt-8 lg:mt-0">
        <div class="mb-3 flex items-baseline justify-between">
          <h2 id="units-title" class="font-display text-xl font-semibold">Units</h2>
          <RouterLink v-if="books.activeBookId" class="text-sm text-accent underline underline-offset-4" :to="{ name: 'units', params: { bookId: books.activeBookId } }">All units</RouterLink>
        </div>
        <ul v-if="previewUnits.length" class="divide-y divide-line border-y border-line">
          <li v-for="summary in previewUnits" :key="summary.unit.id">
            <RouterLink class="flex min-h-11 items-center justify-between gap-3 py-2" :to="{ name: 'unit', params: { unitId: summary.unit.id } }">
              <span class="truncate">{{ summary.unit.title }}</span>
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
