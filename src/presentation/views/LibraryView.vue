<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import { RouterLink } from 'vue-router';
import { container } from '@/container';
import type { LibrarySnapshot } from '@/application/LibraryService';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';

const books = useBooksStore();
const snapshots = shallowRef<ReadonlyMap<string, LibrarySnapshot>>(new Map());

onMounted(async () => {
  const entries = await Promise.all(
    books.books.map(async (book) => [book.id, await container.library.snapshot(book.id)] as const),
  );
  snapshots.value = new Map(entries);
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-6 font-display text-title font-semibold">Library</h1>
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
  </div>
</template>
