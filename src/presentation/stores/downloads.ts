import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { useI18n } from 'vue-i18n';
import { container } from '@/container';
import type { DownloadPlan, DownloadProgress, DownloadSummary, Preflight } from '@/application/DownloadManager';
import { ManifestUnavailableError } from '@/domain/download/errors';
import type { DownloadRecord } from '@/domain/download/models';
import { useFormatBytes } from '@/presentation/composables/useFormatBytes';

interface PendingDownload {
  readonly plan: DownloadPlan;
  readonly preflight: Preflight;
}

export const useDownloadsStore = defineStore('downloads', () => {
  const { t } = useI18n();
  const formatBytes = useFormatBytes();
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

  function describe(failure: unknown): string {
    if (failure instanceof ManifestUnavailableError) {
      return navigator.onLine
        ? t('downloads.errors.manifestOnline')
        : t('downloads.errors.manifestOffline');
    }
    return t('downloads.errors.start');
  }

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
        notice.value = t('downloads.notices.alreadyCached');
        return;
      }
      const preflight = await container.downloads.preflight(plan);
      if (!preflight.fits) {
        error.value = t('downloads.errors.noSpace', {
          required: formatBytes(preflight.requiredBytes),
          available: formatBytes(preflight.availableBytes ?? 0),
        });
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
      error.value = t('downloads.errors.waitRunning');
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
      error.value = t('downloads.errors.waitRunning');
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
