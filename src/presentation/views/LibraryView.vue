<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { container } from '@/container';
import type { LibrarySnapshot } from '@/application/LibraryService';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';
import FavoritesView from './FavoritesView.vue';

const route = useRoute();
const books = useBooksStore();
const snapshots = shallowRef<ReadonlyMap<string, LibrarySnapshot>>(new Map());
const showFavorites = computed(() => route.query.tab === 'favorites');

onMounted(async () => {
  const entries = await Promise.all(
    books.books.map(async (book) => [book.id, await container.library.snapshot(book.id)] as const),
  );
  snapshots.value = new Map(entries);
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-4 font-display text-title font-semibold">Library</h1>

    <nav class="mb-6 inline-flex rounded-lg border border-line bg-surface p-1" aria-label="Library sections">
      <RouterLink
        :to="{ name: 'library' }"
        class="grid min-h-10 min-w-24 place-items-center rounded-md px-4 text-sm"
        :class="showFavorites ? 'text-muted' : 'bg-accent text-[var(--on-accent)]'"
        :aria-current="showFavorites ? undefined : 'page'"
      >
        Books
      </RouterLink>
      <RouterLink
        :to="{ name: 'library', query: { tab: 'favorites' } }"
        class="grid min-h-10 min-w-24 place-items-center rounded-md px-4 text-sm"
        :class="showFavorites ? 'bg-accent text-[var(--on-accent)]' : 'text-muted'"
        :aria-current="showFavorites ? 'page' : undefined"
      >
        Favorites
      </RouterLink>
    </nav>

    <FavoritesView v-if="showFavorites" />
    <template v-else>
      <StateMessage v-if="books.books.length === 0" kind="empty" title="No books yet" body="Add a book to public/data/books.json and it will show up here." />
      <ul v-else class="divide-y divide-line border-y border-line">
        <li v-for="book in books.books" :key="book.id">
          <RouterLink class="flex min-h-16 items-center justify-between gap-4 py-3" :to="{ name: 'units', params: { bookId: book.id } }">
            <span>
              <span class="block font-display text-xl font-semibold">{{ book.title }}</span>
              <span v-if="snapshots.get(book.id)" class="text-sm text-muted">
                {{ snapshots.get(book.id)?.units.length }} units, {{ snapshots.get(book.id)?.totalWords }} words
              </span>
              <span v-else class="skeleton mt-1 block h-4 w-32" aria-hidden="true" />
            </span>
            <span v-if="snapshots.get(book.id)" class="shrink-0 text-sm text-known tabular-nums">{{ snapshots.get(book.id)?.knownWords }} known</span>
          </RouterLink>
        </li>
      </ul>
    </template>
  </div>
</template>
