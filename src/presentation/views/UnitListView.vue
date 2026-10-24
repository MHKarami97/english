<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { container } from '@/container';
import MediaImage from '@/presentation/components/MediaImage.vue';
import SkeletonRows from '@/presentation/components/SkeletonRows.vue';
import StateMessage from '@/presentation/components/StateMessage.vue';
import { useUnitTitle } from '@/presentation/composables/useUnitTitle';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';

const { t } = useI18n();
const unitTitle = useUnitTitle();
const route = useRoute();
const books = useBooksStore();
const catalog = useCatalogStore();
const bookId = computed(() => String(route.params.bookId));
const title = computed(() => books.books.find((book) => book.id === bookId.value)?.title ?? t('unit.listTitle'));

onMounted(async () => {
  await books.setActive(bookId.value);
  await catalog.load(bookId.value);
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-6 font-display text-title font-semibold"><bdi lang="en">{{ title }}</bdi></h1>
    <SkeletonRows v-if="catalog.status === 'loading' || catalog.status === 'idle'" :count="8" :row-height="80" />
    <StateMessage v-else-if="catalog.status === 'error'" kind="error" :title="t('unit.listErrorTitle')" :body="t('common.reloadHint')" />
    <StateMessage v-else-if="!catalog.snapshot?.units.length" kind="empty" :title="t('unit.emptyTitle')" :body="t('unit.emptyBody')" />
    <ul v-else class="card divide-y divide-line">
      <li v-for="summary in catalog.snapshot.units" :key="summary.unit.id">
        <RouterLink class="flex min-h-20 items-center gap-4 px-4 py-3" :to="{ name: 'unit', params: { unitId: summary.unit.id } }">
          <MediaImage class="size-14 shrink-0 rounded-md" :src="container.media.unitImage(summary.unit)" :width="56" :height="56" />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ unitTitle(summary.unit.title) }}</span>
            <span class="text-sm text-muted">{{ t('common.words', { n: summary.total }, summary.total) }}</span>
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
