<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, GraduationCap } from '@lucide/vue';
import { container } from '@/container';
import type { Word } from '@/domain/entities';
import SkeletonRows from '@/presentation/components/SkeletonRows.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import WordRow from '@/presentation/components/WordRow.vue';
import { useWindowVirtualList } from '@/presentation/composables/useWindowVirtualList';
import { useWordList } from '@/presentation/composables/useWordList';

const ROW_HEIGHT = 72;

const route = useRoute();
const router = useRouter();
const unitId = computed(() => String(route.params.unitId));
const title = ref('');
const words = shallowRef<readonly Word[]>([]);
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading');
const wordList = useWordList();

const count = computed(() => words.value.length);
const { listEl, range, offsetY, totalHeight } = useWindowVirtualList(count, ROW_HEIGHT);
const visible = computed(() => words.value.slice(range.value.start, range.value.end));

onMounted(async () => {
  try {
    const session = await container.study.loadUnit(unitId.value);
    if (!session) {
      status.value = 'missing';
      return;
    }
    title.value = session.title;
    words.value = session.words;
    await wordList.loadStates(session.words);
    status.value = 'ready';
  } catch {
    status.value = 'error';
  }
});

const openCard = (word: Word): void => {
  void router.push({ name: 'study-unit', params: { unitId: word.unitId }, query: { word: word.id } });
};
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <RouterLink class="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted" :to="{ name: 'library' }">
      <ArrowLeft class="size-4 rtl:-scale-x-100" aria-hidden="true" /> Library
    </RouterLink>
    <h1 class="mb-6 font-display text-title font-semibold">{{ title || 'Unit' }}</h1>

    <SkeletonRows v-if="status === 'loading'" :count="8" />
    <StateMessage v-else-if="status === 'missing'" kind="empty" title="Unit not found" body="This unit is not in your saved word lists." />
    <StateMessage v-else-if="status === 'error'" kind="error" title="Could not read this unit" body="Reload the page and try again." />

    <template v-else>
      <div ref="listEl" class="card relative overflow-hidden" :style="{ blockSize: `${totalHeight}px` }">
        <ul class="absolute inset-x-0 top-0" :style="{ transform: `translateY(${offsetY}px)` }" :aria-label="`Words in ${title}`">
          <li
            v-for="(word, position) in visible"
            :key="word.id"
            class="border-b border-line"
            :aria-setsize="count"
            :aria-posinset="range.start + position + 1"
          >
            <WordRow
              :word="word"
              :state="wordList.states.value.get(word.id) ?? null"
              @open="openCard"
              @play="wordList.play"
              @favorite="wordList.toggleFavorite"
              @knowledge="wordList.toggleKnown"
            />
          </li>
        </ul>
      </div>
      <div class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-4 md:bottom-4">
        <RouterLink class="btn btn-primary w-full" :to="{ name: 'study-unit', params: { unitId } }">
          <GraduationCap class="size-5" aria-hidden="true" /> Study this unit
        </RouterLink>
      </div>
    </template>
  </div>
</template>
