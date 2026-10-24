<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { GraduationCap } from '@lucide/vue';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import SkeletonRows from '@/presentation/components/SkeletonRows.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import WordRow from '@/presentation/components/WordRow.vue';
import { useWordList } from '@/presentation/composables/useWordList';
import { useBooksStore } from '@/presentation/stores/books';

// Rendered as the Favorites tab of the Library screen, so it has no page wrapper or heading of its own.
const { t } = useI18n();
const router = useRouter();
const books = useBooksStore();
const wordList = useWordList();
const words = shallowRef<readonly Word[]>([]);
const status = ref<'loading' | 'ready' | 'error'>('loading');

onMounted(async () => {
  if (!books.activeBookId) return;
  try {
    const session = await container.study.loadFavorites(books.activeBookId);
    words.value = session.words;
    await wordList.loadStates(session.words);
    status.value = 'ready';
  } catch {
    status.value = 'error';
  }
});

async function toggleFavorite(word: Word): Promise<void> {
  const state = await wordList.toggleFavorite(word);
  if (!state.isFavorite) words.value = words.value.filter((candidate) => candidate.id !== word.id);
}

const openCard = (word: Word): void => {
  void router.push({ name: 'study-unit', params: { unitId: word.unitId }, query: { word: word.id } });
};
</script>

<template>
  <div>
    <div v-if="words.length" class="mb-4 flex justify-end">
      <RouterLink class="btn btn-primary" :to="{ name: 'study-favorites' }">
        <GraduationCap class="size-5" aria-hidden="true" /> {{ t('favorites.study') }}
      </RouterLink>
    </div>
    <SkeletonRows v-if="status === 'loading'" :count="5" />
    <StateMessage v-else-if="status === 'error'" kind="error" :title="t('favorites.readError')" :body="t('common.reloadHint')" />
    <StateMessage v-else-if="words.length === 0" kind="empty" :title="t('favorites.emptyTitle')" :body="t('favorites.emptyBody')" />
    <ul v-else class="card divide-y divide-line">
      <li v-for="word in words" :key="word.id" style="content-visibility: auto; contain-intrinsic-size: auto 72px">
        <WordRow :word="word" :state="wordList.states.value.get(word.id) ?? null" @open="openCard" @play="wordList.play" @favorite="toggleFavorite" @knowledge="wordList.toggleKnown" />
      </li>
    </ul>
  </div>
</template>
