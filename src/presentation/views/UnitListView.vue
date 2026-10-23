<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { container } from '@/container';
import MediaImage from '@/presentation/components/MediaImage.vue';
import SkeletonRows from '@/presentation/components/SkeletonRows.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';

const route = useRoute();
const books = useBooksStore();
const catalog = useCatalogStore();
const bookId = computed(() => String(route.params.bookId));
const title = computed(() => books.books.find((book) => book.id === bookId.value)?.title ?? 'Units');

onMounted(async () => {
  await books.setActive(bookId.value);
  await catalog.load(bookId.value);
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-6 font-display text-title font-semibold">{{ title }}</h1>
    <SkeletonRows v-if="catalog.status === 'loading' || catalog.status === 'idle'" :count="8" :row-height="80" />
    <StateMessage v-else-if="catalog.status === 'error'" kind="error" title="Could not read the units" body="Reload the page and try again." />
    <StateMessage v-else-if="!catalog.snapshot?.units.length" kind="empty" title="No units in this book" body="The book's data file has no flashcard units." />
    <ul v-else class="card divide-y divide-line">
      <li v-for="summary in catalog.snapshot.units" :key="summary.unit.id">
        <RouterLink class="flex min-h-20 items-center gap-4 px-4 py-3" :to="{ name: 'unit', params: { unitId: summary.unit.id } }">
          <MediaImage class="size-14 shrink-0 rounded-md" :src="container.media.unitImage(summary.unit)" :width="56" :height="56" />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ summary.unit.title }}</span>
            <span class="text-sm text-muted">{{ summary.total }} words</span>
          </span>
          <span class="w-24 shrink-0">
            <span class="block text-end text-sm tabular-nums">{{ summary.known }} / {{ summary.total }}</span>
            <span class="bar mt-1 block"><span :style="{ inlineSize: `${summary.total ? (summary.known / summary.total) * 100 : 0}%` }" /></span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
