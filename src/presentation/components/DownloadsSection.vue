<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ConfirmDialog from '@/presentation/components/ConfirmDialog.vue';
import { useFormatBytes } from '@/presentation/composables/useFormatBytes';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { useDownloadsStore } from '@/presentation/stores/downloads';

const { t, n } = useI18n();
const formatBytes = useFormatBytes();
const books = useBooksStore();
const catalog = useCatalogStore();
const store = useDownloadsStore();
const removeAllDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);

const bookId = computed(() => books.activeBookId ?? '');
const units = computed(() => catalog.snapshot?.units ?? []);
const recordByUnit = computed(() => new Map(store.records.map((record) => [record.unitId, record] as const)));
const running = computed(() => store.progress.phase !== 'idle');
const busy = computed(() => running.value || store.loading);
const hasDownloads = computed(() => store.records.some((record) => record.cachedFiles > 0));
const percent = computed(() => {
  const { totalBytes, doneBytes, totalFiles, doneFiles } = store.progress;
  const ratio = totalBytes > 0 ? doneBytes / totalBytes : totalFiles > 0 ? doneFiles / totalFiles : 0;
  return Math.min(100, Math.round(ratio * 100));
});
const outcome = computed(() => {
  const result = store.summary;
  if (!result) return '';
  if (result.quotaExceeded) return t('downloads.outcome.quota');
  if (result.failedUrls.length > 0) return t('downloads.outcome.failed', { n: n(result.failedUrls.length) }, result.failedUrls.length);
  if (result.cancelled) return t('downloads.outcome.cancelled');
  return t('downloads.outcome.done', { n: n(result.completedFiles) }, result.completedFiles);
});

function statusLabel(unitId: string): string {
  const record = recordByUnit.value.get(unitId);
  if (!record || record.status === 'none') return t('downloads.status.none');
  if (record.status === 'complete') return t('downloads.status.complete', { size: formatBytes(record.totalBytes) });
  return t('downloads.status.partial', { done: n(record.cachedFiles), total: n(record.totalFiles) });
}

const isComplete = (unitId: string): boolean => recordByUnit.value.get(unitId)?.status === 'complete';
const hasFiles = (unitId: string): boolean => (recordByUnit.value.get(unitId)?.cachedFiles ?? 0) > 0;

onMounted(async () => {
  if (!bookId.value) return;
  if (!catalog.snapshot) await catalog.load(bookId.value);
  await store.load(bookId.value);
});
</script>

<template>
  <section aria-labelledby="downloads-title">
    <h2 id="downloads-title" class="mb-1 font-medium">{{ t('downloads.title') }}</h2>
    <p class="mb-3 text-sm text-muted">
      {{ t('downloads.hint') }}
      <template v-if="store.downloadedBytes > 0"> {{ t('downloads.downloadedSize', { size: formatBytes(store.downloadedBytes) }) }}</template>
    </p>

    <p v-if="store.error" class="mb-3 text-sm text-unknown" role="alert">{{ store.error }}</p>
    <p v-if="store.notice" class="mb-3 text-sm text-muted" role="status">{{ store.notice }}</p>
    <p v-if="outcome && !running" class="mb-3 text-sm" role="status">{{ outcome }}</p>

    <div v-if="store.pending && !running" class="card mb-3 p-4" role="group" :aria-label="t('downloads.confirmGroup')">
      <p>{{ t('downloads.confirmBody', { size: formatBytes(store.pending.preflight.requiredBytes) }) }}</p>
      <div class="mt-3 flex flex-wrap gap-3">
        <button type="button" class="btn btn-primary" @click="store.begin()">{{ t('downloads.download') }}</button>
        <button type="button" class="btn" @click="store.dismissPending()">{{ t('common.cancel') }}</button>
      </div>
    </div>

    <div v-if="running" class="card mb-3 p-4">
      <div role="progressbar" :aria-label="t('downloads.progressLabel')" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="percent" class="h-2 overflow-hidden rounded-full bg-line">
        <div class="h-full bg-accent" :style="{ width: `${percent}%` }" />
      </div>
      <p class="mt-2 text-sm text-muted tabular-nums" aria-live="polite">
        {{ t('downloads.progress', { done: n(store.progress.doneFiles), total: n(store.progress.totalFiles), doneBytes: formatBytes(store.progress.doneBytes), totalBytes: formatBytes(store.progress.totalBytes) }) }}<template v-if="store.progress.failedFiles > 0">{{ t('downloads.failedSuffix', { n: n(store.progress.failedFiles) }) }}</template><template v-if="store.progress.phase === 'paused'">{{ t('downloads.pausedSuffix') }}</template>
      </p>
      <div class="mt-3 flex flex-wrap gap-3">
        <button v-if="store.progress.phase === 'running'" type="button" class="btn" @click="store.pause()">{{ t('downloads.pause') }}</button>
        <button v-else type="button" class="btn btn-primary" @click="store.resume()">{{ t('downloads.resume') }}</button>
        <button type="button" class="btn" @click="store.cancel()">{{ t('downloads.stop') }}</button>
      </div>
    </div>

    <div class="mb-3 flex flex-wrap gap-3">
      <button type="button" class="btn btn-primary" :disabled="busy || !bookId" @click="store.prepare(bookId)">{{ t('downloads.downloadAll') }}</button>
      <button type="button" class="btn" :disabled="busy || !hasDownloads" @click="removeAllDialog?.open()">{{ t('downloads.removeAll') }}</button>
    </div>

    <ul v-if="units.length > 0" class="max-h-80 overflow-y-auto rounded-lg border border-line bg-surface">
      <li v-for="summary in units" :key="summary.unit.id" class="flex min-h-11 items-center gap-3 px-3 py-1">
        <span class="min-w-0 flex-1">
          <bdi class="block truncate" lang="en" dir="ltr">{{ summary.unit.title }}</bdi>
          <span class="block text-sm text-muted">{{ statusLabel(summary.unit.id) }}</span>
        </span>
        <button v-if="!isComplete(summary.unit.id)" type="button" class="btn" :disabled="busy" :aria-label="t('downloads.downloadUnit', { unit: summary.unit.title })" @click="store.prepare(bookId, [summary.unit.id])">
          {{ t('downloads.download') }}
        </button>
        <button v-if="hasFiles(summary.unit.id)" type="button" class="btn" :disabled="busy" :aria-label="t('downloads.removeUnit', { unit: summary.unit.title })" @click="store.removeUnits([summary.unit.id])">
          {{ t('downloads.remove') }}
        </button>
      </li>
    </ul>

    <ConfirmDialog ref="removeAllDialog" :title="t('downloads.removeAllTitle')" :body="t('downloads.removeAllBody')" :confirm-label="t('downloads.remove')" @confirm="store.removeAll()" />
  </section>
</template>
