<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import type { SearchIndex } from '@/infrastructure/search/SearchIndex';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';

const { t } = useI18n();
const books = useBooksStore();
const catalog = useCatalogStore();
const query = ref('');
const unitId = ref('');
const pos = ref('');
const index = shallowRef<SearchIndex | null>(null);
const results = shallowRef<readonly Word[]>([]);
const status = ref<'loading' | 'ready' | 'error'>('loading');
let timer: ReturnType<typeof setTimeout> | undefined;

const units = computed(() => catalog.snapshot?.units ?? []);
const hasInput = computed(() => query.value.trim().length > 0 || unitId.value !== '' || pos.value !== '');

function run(): void {
  results.value = index.value?.search(query.value, { unitId: unitId.value || undefined, pos: pos.value || undefined }) ?? [];
}

function onInput(): void {
  clearTimeout(timer);
  timer = setTimeout(run, 120);
}

onMounted(async () => {
  const bookId = books.activeBookId;
  if (!bookId) return;
  try {
    const [prepared] = await Promise.all([container.search.prepare(bookId), catalog.load(bookId)]);
    index.value = markRaw(prepared);
    status.value = 'ready';
  } catch {
    status.value = 'error';
  }
});

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-4 font-display text-title font-semibold">{{ t('search.title') }}</h1>
    <form role="search" class="space-y-3" @submit.prevent="run">
      <label class="sr-only" for="q">{{ t('search.label') }}</label>
      <input id="q" v-model="query" type="search" dir="auto" autocomplete="off" enterkeyhint="search" :placeholder="t('search.placeholder')" class="min-h-11 w-full rounded-lg border border-line bg-surface px-4" :disabled="status !== 'ready'" @input="onInput" />
      <div class="grid grid-cols-2 gap-3">
        <label class="text-sm text-muted">{{ t('search.unit') }}
          <select v-model="unitId" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink" @change="run">
            <option value="">{{ t('home.allUnits') }}</option>
            <option v-for="summary in units" :key="summary.unit.id" :value="summary.unit.id">{{ summary.unit.title }}</option>
          </select>
        </label>
        <label class="text-sm text-muted">{{ t('search.pos') }}
          <select v-model="pos" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink" @change="run">
            <option value="">{{ t('search.any') }}</option>
            <option v-for="option in index?.posOptions ?? []" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
      </div>
    </form>

    <div class="mt-6">
      <div v-if="status === 'loading'" class="space-y-3" aria-hidden="true"><div v-for="row in 5" :key="row" class="skeleton h-14 w-full" /></div>
      <StateMessage v-else-if="status === 'error'" kind="error" :title="t('search.errorTitle')" :body="t('search.errorBody')" />
      <StateMessage v-else-if="!hasInput" kind="empty" :title="t('search.typeTitle')" :body="t('search.typeBody')" />
      <StateMessage v-else-if="results.length === 0" kind="empty" :title="t('search.noneTitle')" :body="t('search.noneBody')" />
      <template v-else>
        <p class="mb-2 text-sm text-muted" aria-live="polite">{{ t('search.results', { n: results.length }, results.length) }}</p>
        <ul class="card divide-y divide-line">
          <li v-for="word in results" :key="word.id">
            <RouterLink class="block min-h-14 px-4 py-3" :to="{ name: 'study-unit', params: { unitId: word.unitId }, query: { word: word.id } }">
              <bdi class="font-display text-lg font-semibold" lang="en" dir="ltr">{{ word.word }}</bdi>
              <bdi class="ms-2 text-sm text-muted" lang="en" dir="ltr">{{ word.pos }}</bdi>
              <bdi class="mt-0.5 block truncate text-sm text-muted" lang="en" dir="ltr">{{ word.definition }}</bdi>
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>
