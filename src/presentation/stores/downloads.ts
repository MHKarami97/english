import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { DownloadPlan, DownloadProgress, DownloadSummary, Preflight } from '@/application/DownloadManager';
import { ManifestUnavailableError } from '@/domain/download/errors';
import type { DownloadRecord } from '@/domain/download/models';
import { formatBytes } from '@/presentation/formatBytes';

interface PendingDownload {
  readonly plan: DownloadPlan;
  readonly preflight: Preflight;
}

function describe(error: unknown): string {
  if (error instanceof ManifestUnavailableError) {
    return navigator.onLine
      ? 'Offline downloads are not available for this book yet.'
      : 'You are offline. Connect to the internet to download.';
  }
  return 'The download could not start. Check your connection and try again.';
}

export const useDownloadsStore = defineStore('downloads', () => {
  const records = shallowRef<readonly DownloadRecord[]>([]);
  const progress = ref<DownloadProgress>(container.downloads.snapshot());
  const pending = shallowRef<PendingDownload | null>(null);
  const summary = shallowRef<DownloadSummary | null>(null);
  const error = ref('');
  const notice = ref('');
  const loading = ref(false);
  let bookId = '';
  let subscribed = false;

  const downloadedBytes = computed(() =>
    records.value.filter((record) => record.status === 'complete').reduce((sum, record) => sum + record.totalBytes, 0),
  );

  async function load(id: string): Promise<void> {
    bookId = id;
    if (!subscribed) {
      subscribed = true;
      container.downloads.subscribe((next) => {
        progress.value = next;
      });
    }
    records.value = await container.downloads.reconcile(id);
  }

  async function prepare(id: string, unitIds?: readonly string[]): Promise<void> {
    error.value = '';
    notice.value = '';
    summary.value = null;
    pending.value = null;
    loading.value = true;
    try {
      const plan = await container.downloads.plan(id, unitIds);
      if (plan.missing.length === 0) {
        notice.value = 'Everything you picked is already on this device.';
        return;
      }
      const preflight = await container.downloads.preflight(plan);
      if (!preflight.fits) {
        error.value = `Not enough free space. This needs about ${formatBytes(preflight.requiredBytes)} and the device has about ${formatBytes(preflight.availableBytes ?? 0)} to spare.`;
        return;
      }
      pending.value = { plan, preflight };
    } catch (failure) {
      error.value = describe(failure);
    } finally {
      loading.value = false;
    }
    if (pending.value && !pending.value.preflight.needsConfirm) await begin();
  }

  async function begin(): Promise<void> {
    const current = pending.value;
    if (!current) return;
    pending.value = null;
    // Asks the browser to keep the files when space runs low; a refusal changes nothing.
    await container.storage.persist().catch(() => null);
    try {
      summary.value = await container.downloads.start(current.plan);
    } catch (failure) {
      error.value = describe(failure);
    } finally {
      records.value = await container.downloads.reconcile(bookId).catch(() => records.value);
    }
  }

  function dismissPending(): void {
    pending.value = null;
  }

  const pause = (): void => container.downloads.pause();
  const resume = (): void => container.downloads.resume();
  const cancel = (): void => container.downloads.cancel();

  async function removeUnits(unitIds: readonly string[]): Promise<void> {
    error.value = '';
    notice.value = '';
    summary.value = null;
    try {
      records.value = await container.downloads.removeUnits(bookId, unitIds);
    } catch {
      error.value = 'Wait for the running download to finish first.';
    }
  }

  async function removeAll(): Promise<void> {
    error.value = '';
    notice.value = '';
    summary.value = null;
    try {
      await container.downloads.removeBook(bookId);
      records.value = [];
    } catch {
      error.value = 'Wait for the running download to finish first.';
    }
  }

  return {
    records,
    progress,
    pending,
    summary,
    error,
    notice,
    loading,
    downloadedBytes,
    load,
    prepare,
    begin,
    dismissPending,
    pause,
    resume,
    cancel,
    removeUnits,
    removeAll,
  };
});
