<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ConfirmDialog from '@/presentation/components/ConfirmDialog.vue';
import { formatBytes } from '@/presentation/formatBytes';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { useDownloadsStore } from '@/presentation/stores/downloads';

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
  if (result.quotaExceeded) return 'The device ran out of space. What was downloaded is kept.';
  if (result.failedUrls.length > 0) {
    return `${result.failedUrls.length} files could not be downloaded. Download again to fetch only those.`;
  }
  if (result.cancelled) return 'Download stopped. What was downloaded is kept.';
  return `Done. ${result.completedFiles} files are now available offline.`;
});

function statusLabel(unitId: string): string {
  const record = recordByUnit.value.get(unitId);
  if (!record || record.status === 'none') return 'Not downloaded';
  if (record.status === 'complete') return `Downloaded, ${formatBytes(record.totalBytes)}`;
  return `${record.cachedFiles} of ${record.totalFiles} files`;
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
    <h2 id="downloads-title" class="mb-1 font-medium">Offline audio and pictures</h2>
    <p class="mb-3 text-sm text-muted">
      Download units to hear and see every word without a connection. The words and your progress already work offline.
      <template v-if="store.downloadedBytes > 0">{{ formatBytes(store.downloadedBytes) }} downloaded.</template>
    </p>

    <p v-if="store.error" class="mb-3 text-sm text-unknown" role="alert">{{ store.error }}</p>
    <p v-if="store.notice" class="mb-3 text-sm text-muted" role="status">{{ store.notice }}</p>
    <p v-if="outcome && !running" class="mb-3 text-sm" role="status">{{ outcome }}</p>

    <div v-if="store.pending && !running" class="card mb-3 p-4" role="group" aria-label="Confirm download">
      <p>This will download about {{ formatBytes(store.pending.preflight.requiredBytes) }}. Wi-Fi is recommended.</p>
      <div class="mt-3 flex flex-wrap gap-3">
        <button type="button" class="btn btn-primary" @click="store.begin()">Download</button>
        <button type="button" class="btn" @click="store.dismissPending()">Cancel</button>
      </div>
    </div>

    <div v-if="running" class="card mb-3 p-4">
      <div
        role="progressbar"
        aria-label="Download progress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="percent"
        class="h-2 overflow-hidden rounded-full bg-line"
      >
        <div class="h-full bg-accent" :style="{ width: `${percent}%` }" />
      </div>
      <p class="mt-2 text-sm text-muted tabular-nums" aria-live="polite">
        {{ store.progress.doneFiles }} of {{ store.progress.totalFiles }} files,
        {{ formatBytes(store.progress.doneBytes) }} of {{ formatBytes(store.progress.totalBytes) }}
        <template v-if="store.progress.failedFiles > 0">, {{ store.progress.failedFiles }} failed</template>
        <template v-if="store.progress.phase === 'paused'">, paused</template>
      </p>
      <div class="mt-3 flex flex-wrap gap-3">
        <button v-if="store.progress.phase === 'running'" type="button" class="btn" @click="store.pause()">Pause</button>
        <button v-else type="button" class="btn btn-primary" @click="store.resume()">Resume</button>
        <button type="button" class="btn" @click="store.cancel()">Stop</button>
      </div>
    </div>

    <div class="mb-3 flex flex-wrap gap-3">
      <button type="button" class="btn btn-primary" :disabled="busy || !bookId" @click="store.prepare(bookId)">Download all units</button>
      <button type="button" class="btn" :disabled="busy || !hasDownloads" @click="removeAllDialog?.open()">Remove all downloads</button>
    </div>

    <ul v-if="units.length > 0" class="max-h-80 overflow-y-auto rounded-lg border border-line bg-surface">
      <li v-for="summary in units" :key="summary.unit.id" class="flex min-h-11 items-center gap-3 px-3 py-1">
        <span class="min-w-0 flex-1">
          <span class="block truncate">{{ summary.unit.title }}</span>
          <span class="block text-sm text-muted">{{ statusLabel(summary.unit.id) }}</span>
        </span>
        <button
          v-if="!isComplete(summary.unit.id)"
          type="button"
          class="btn"
          :disabled="busy"
          :aria-label="`Download ${summary.unit.title}`"
          @click="store.prepare(bookId, [summary.unit.id])"
        >
          Download
        </button>
        <button
          v-if="hasFiles(summary.unit.id)"
          type="button"
          class="btn"
          :disabled="busy"
          :aria-label="`Remove ${summary.unit.title}`"
          @click="store.removeUnits([summary.unit.id])"
        >
          Remove
        </button>
      </li>
    </ul>

    <ConfirmDialog
      ref="removeAllDialog"
      title="Remove all downloads?"
      body="Audio and pictures you downloaded are deleted from this device. They will stream again when you are online. Your progress is not touched."
      confirm-label="Remove"
      @confirm="store.removeAll()"
    />
  </section>
</template>
