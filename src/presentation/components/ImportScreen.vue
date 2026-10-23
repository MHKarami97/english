<script setup lang="ts">
import { computed } from 'vue';
import { APP_NAME } from '@/config/app';
import StateMessage from './StateMessage.vue';
import { useBooksStore } from '@/presentation/stores/books';

const books = useBooksStore();
const importing = computed(() => books.phase === 'importing' && (books.progress?.total ?? 0) > 0);
</script>

<template>
  <div class="mx-auto grid min-h-dvh max-w-md place-items-center px-6">
    <StateMessage
      v-if="books.phase === 'error'"
      :kind="books.errorKind === 'offline' ? 'offline' : 'error'"
      :title="books.errorKind === 'offline' ? 'No word lists saved yet' : 'The word lists did not load'"
      :body="
        books.errorKind === 'offline'
          ? 'The first launch needs a connection to save the words on this device. Connect once and try again.'
          : 'Something went wrong while reading the word lists. Check your connection and try again.'
      "
    >
      <button type="button" class="btn btn-primary" @click="books.bootstrap()">Try again</button>
    </StateMessage>

    <div v-else class="w-full" role="status">
      <p class="font-display text-title font-semibold">{{ APP_NAME }}</p>
      <p class="mt-2 text-muted">
        {{ importing ? 'Saving your word lists on this device. This happens only once.' : 'Opening your library.' }}
      </p>
      <progress
        v-if="importing"
        class="mt-6 block h-1 w-full accent-[var(--accent)]"
        :value="books.progress?.done"
        :max="books.progress?.total"
        aria-label="Import progress"
      />
      <div v-else class="mt-6 space-y-3" aria-hidden="true">
        <div class="skeleton h-4 w-3/4" />
        <div class="skeleton h-4 w-1/2" />
      </div>
    </div>
  </div>
</template>
