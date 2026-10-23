<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { container } from '@/container';
import { BackupError, parseBackup, type ProgressBackup } from '@/data/backup/backupSchema';
import type { ImportMode } from '@/data/backup/ProgressBackupService';
import { STUDY_SETTING_LIMITS, type StudySettings } from '@/domain/study/models';
import type { StorageUsage } from '@/infrastructure/storage/StorageEstimator';
import ConfirmDialog from '@/presentation/components/ConfirmDialog.vue';
import { useBooksStore } from '@/presentation/stores/books';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { useSettingsStore, type ThemeChoice } from '@/presentation/stores/settings';
import { useStudySettingsStore } from '@/presentation/stores/studySettings';
import { useTodayStore } from '@/presentation/stores/today';

type NumericSetting = 'newPerDay' | 'maxReviewsPerDay' | 'dayRolloverHour';

const settings = useSettingsStore();
const study = useStudySettingsStore();
const catalog = useCatalogStore();
const books = useBooksStore();
const today = useTodayStore();

const marksDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const unitDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const allDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const importDialog = ref<InstanceType<typeof ConfirmDialog> | null>(null);
const usage = ref<StorageUsage | null>(null);
const persisted = ref<boolean | null>(null);
const message = ref('');
const importError = ref('');
const pendingBackup = shallowRef<ProgressBackup | null>(null);
const importMode = ref<ImportMode>('merge');
const resetUnitId = ref('');

const themes: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const limits = STUDY_SETTING_LIMITS;
const units = computed(() => catalog.snapshot?.units ?? []);
const activeIds = computed(() => new Set(study.settings.activeUnitIds ?? units.value.map((summary) => summary.unit.id)));
const resetUnitTitle = computed(() => units.value.find((summary) => summary.unit.id === resetUnitId.value)?.unit.title ?? '');

const formatBytes = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
const persistedLabel = computed(() =>
  persisted.value === null ? 'not supported by this browser' : persisted.value ? 'granted' : 'not granted yet',
);

onMounted(async () => {
  await study.load();
  usage.value = await container.storage.estimate();
  persisted.value = await container.storage.isPersisted();
  if (books.activeBookId) await catalog.load(books.activeBookId);
  resetUnitId.value = units.value[0]?.unit.id ?? '';
});

async function setNumber(key: NumericSetting, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const next = await study.update({ [key]: Number(input.value) });
  input.value = String(next[key]);
}

async function setBoolean(key: 'showIntervalsOnButtons' | 'skipKnownWords', event: Event): Promise<void> {
  await study.update({ [key]: (event.target as HTMLInputElement).checked });
}

async function setOrder(event: Event): Promise<void> {
  await study.update({ newCardOrder: (event.target as HTMLSelectElement).value as StudySettings['newCardOrder'] });
}

async function toggleUnit(unitId: string, checked: boolean): Promise<void> {
  const next = new Set(activeIds.value);
  if (checked) next.add(unitId);
  else next.delete(unitId);
  const all = units.value.map((summary) => summary.unit.id);
  await study.update({ activeUnitIds: all.every((id) => next.has(id)) ? null : all.filter((id) => next.has(id)) });
}

async function resetMarks(): Promise<void> {
  await container.progress.resetAll();
  catalog.invalidate();
  message.value = 'Your known, unknown and favorite marks were cleared.';
}

async function resetUnitSchedule(): Promise<void> {
  const removed = await container.reset.resetUnit(resetUnitId.value);
  today.$reset();
  message.value = `The schedule for ${resetUnitTitle.value} was reset (${removed} cards).`;
}

async function resetAllReviews(): Promise<void> {
  await container.reset.resetAll();
  today.$reset();
  message.value = 'All review progress was cleared. Your word lists and marks are untouched.';
}

async function requestPersistence(): Promise<void> {
  await container.storage.persist();
  persisted.value = await container.storage.isPersisted();
}

async function exportProgress(): Promise<void> {
  const backup = await container.backup.export(container.clock.now().getTime());
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `lexi-book-progress-${container.clock.now().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  message.value = 'Progress exported.';
}

async function chooseImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  importError.value = '';
  if (!file) return;
  try {
    pendingBackup.value = parseBackup(await file.text());
    importMode.value = 'merge';
    importDialog.value?.open();
  } catch (error) {
    pendingBackup.value = null;
    importError.value = error instanceof BackupError ? error.message : 'The file could not be read.';
  }
}

async function confirmImport(): Promise<void> {
  const backup = pendingBackup.value;
  if (!backup) return;
  const summary = await container.backup.import(backup, importMode.value);
  pendingBackup.value = null;
  catalog.invalidate();
  today.$reset();
  await study.load();
  await settings.init();
  message.value = `Imported ${summary.reviewCards} cards, ${summary.reviewLogs} review records and ${summary.wordStates} word marks.`;
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-8 font-display text-title font-semibold">Settings</h1>
    <p v-if="message" class="mb-6 rounded-lg border border-line bg-surface px-4 py-3 text-sm" role="status">{{ message }}</p>

    <fieldset class="mb-8">
      <legend class="mb-2 font-medium">Theme</legend>
      <div class="inline-flex rounded-lg border border-line bg-surface p-1">
        <label v-for="theme in themes" :key="theme.value" class="relative">
          <input class="peer sr-only" type="radio" name="theme" :value="theme.value" :checked="settings.theme === theme.value" @change="settings.setTheme(theme.value)" />
          <span class="grid min-h-10 min-w-20 cursor-pointer place-items-center rounded-md px-3 text-sm peer-checked:bg-accent peer-checked:text-[var(--on-accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{{ theme.label }}</span>
        </label>
      </div>
    </fieldset>

    <div class="mb-8 flex items-center justify-between gap-4">
      <div>
        <p id="autoplay-label" class="font-medium">Play audio when a card flips</p>
        <p class="text-sm text-muted">The word is read aloud as the answer side appears.</p>
      </div>
      <input type="checkbox" role="switch" aria-labelledby="autoplay-label" class="size-6 accent-[var(--accent)]" :checked="settings.autoPlayOnFlip" @change="settings.setAutoPlay(($event.target as HTMLInputElement).checked)" />
    </div>

    <section class="mb-8" aria-labelledby="study-title">
      <h2 id="study-title" class="mb-3 font-display text-xl font-semibold">Study</h2>
      <div class="grid gap-4 sm:grid-cols-3">
        <label class="text-sm">
          <span class="text-muted">New words per day ({{ limits.newPerDay.min }}-{{ limits.newPerDay.max }})</span>
          <input type="number" inputmode="numeric" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3" :min="limits.newPerDay.min" :max="limits.newPerDay.max" :value="study.settings.newPerDay" @change="setNumber('newPerDay', $event)" />
        </label>
        <label class="text-sm">
          <span class="text-muted">Reviews per day ({{ limits.maxReviewsPerDay.min }}-{{ limits.maxReviewsPerDay.max }})</span>
          <input type="number" inputmode="numeric" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3" :min="limits.maxReviewsPerDay.min" :max="limits.maxReviewsPerDay.max" :value="study.settings.maxReviewsPerDay" @change="setNumber('maxReviewsPerDay', $event)" />
        </label>
        <label class="text-sm">
          <span class="text-muted">New day starts at ({{ limits.dayRolloverHour.min }}-{{ limits.dayRolloverHour.max }} h)</span>
          <input type="number" inputmode="numeric" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3" :min="limits.dayRolloverHour.min" :max="limits.dayRolloverHour.max" :value="study.settings.dayRolloverHour" @change="setNumber('dayRolloverHour', $event)" />
        </label>
      </div>

      <label class="mt-4 block text-sm">
        <span class="text-muted">Order of new words</span>
        <select class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink" :value="study.settings.newCardOrder" @change="setOrder">
          <option value="unit-order">Book order</option>
          <option value="random">Random</option>
        </select>
      </label>

      <div class="mt-4 flex items-center justify-between gap-4">
        <p id="intervals-label" class="text-sm">Show the next interval on the rating buttons</p>
        <input type="checkbox" role="switch" aria-labelledby="intervals-label" class="size-6 accent-[var(--accent)]" :checked="study.settings.showIntervalsOnButtons" @change="setBoolean('showIntervalsOnButtons', $event)" />
      </div>
      <div class="mt-4 flex items-center justify-between gap-4">
        <p id="skip-label" class="text-sm">Do not introduce words I marked as known</p>
        <input type="checkbox" role="switch" aria-labelledby="skip-label" class="size-6 accent-[var(--accent)]" :checked="study.settings.skipKnownWords" @change="setBoolean('skipKnownWords', $event)" />
      </div>

      <fieldset class="mt-6">
        <legend class="mb-2 text-sm font-medium">Units to learn from</legend>
        <p v-if="study.settings.activeUnitIds && study.settings.activeUnitIds.length === 0" class="mb-2 text-sm text-unknown">No unit is selected, so no new words will be introduced.</p>
        <ul class="max-h-64 overflow-y-auto rounded-lg border border-line bg-surface">
          <li v-for="summary in units" :key="summary.unit.id">
            <label class="flex min-h-11 cursor-pointer items-center gap-3 px-3">
              <input type="checkbox" class="size-5 accent-[var(--accent)]" :checked="activeIds.has(summary.unit.id)" @change="toggleUnit(summary.unit.id, ($event.target as HTMLInputElement).checked)" />
              <span class="flex-1 truncate">{{ summary.unit.title }}</span>
              <span class="text-sm text-muted tabular-nums">{{ summary.total }}</span>
            </label>
          </li>
        </ul>
      </fieldset>

      <div class="mt-6 flex flex-wrap items-end gap-3">
        <label class="min-w-0 flex-1 text-sm">
          <span class="text-muted">Reset schedule for one unit</span>
          <select v-model="resetUnitId" class="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink">
            <option v-for="summary in units" :key="summary.unit.id" :value="summary.unit.id">{{ summary.unit.title }}</option>
          </select>
        </label>
        <button type="button" class="btn" :disabled="!resetUnitId" @click="unitDialog?.open()">Reset unit</button>
      </div>
      <button type="button" class="btn mt-4" @click="allDialog?.open()">Reset all review progress</button>
    </section>

    <section class="mb-8" aria-labelledby="storage-title">
      <h2 id="storage-title" class="mb-2 font-medium">Storage on this device</h2>
      <p v-if="usage" class="text-sm text-muted">{{ formatBytes(usage.usage) }} used of about {{ formatBytes(usage.quota) }} available.</p>
      <p v-else class="text-sm text-muted">Your browser does not report storage usage.</p>
      <p class="mt-1 text-sm text-muted">Persistent storage: {{ persistedLabel }}. It asks the browser not to clear your progress when space runs low.</p>
      <button v-if="persisted === false" type="button" class="btn mt-3" @click="requestPersistence">Request persistent storage</button>
    </section>

    <section class="mb-8" aria-labelledby="backup-title">
      <h2 id="backup-title" class="mb-1 font-medium">Back up your progress</h2>
      <p class="mb-3 text-sm text-muted">Saves your review schedule, history, marks and settings. The word lists are not included.</p>
      <div class="flex flex-wrap gap-3">
        <button type="button" class="btn" @click="exportProgress">Export progress (JSON)</button>
        <label class="btn cursor-pointer">
          Import progress (JSON)
          <input type="file" accept="application/json,.json" class="sr-only" @change="chooseImportFile" />
        </label>
      </div>
      <p v-if="importError" class="mt-3 text-sm text-unknown" role="alert">{{ importError }}</p>
    </section>

    <section class="mb-8" aria-labelledby="marks-heading">
      <h2 id="marks-heading" class="mb-1 font-medium">Reset word marks</h2>
      <p class="mb-3 text-sm text-muted">Clears known and unknown marks, favorites and your last browsing position.</p>
      <button type="button" class="btn" @click="marksDialog?.open()">Reset word marks</button>
    </section>

    <p class="text-sm text-muted">Version {{ __APP_VERSION__ }}</p>

    <ConfirmDialog ref="marksDialog" title="Reset word marks?" body="This cannot be undone. Your review schedule and word lists stay on the device." confirm-label="Reset marks" @confirm="resetMarks" />
    <ConfirmDialog ref="unitDialog" title="Reset this unit's schedule?" :body="`Every card from ${resetUnitTitle} becomes new again. Your history is kept.`" confirm-label="Reset unit" @confirm="resetUnitSchedule" />
    <ConfirmDialog ref="allDialog" title="Reset all review progress?" body="All schedules, history and daily statistics are deleted. Word marks and word lists stay. This cannot be undone." confirm-label="Reset everything" @confirm="resetAllReviews" />
    <ConfirmDialog ref="importDialog" title="Import this progress file?" :body="`The file holds ${pendingBackup?.data.reviewCards.length ?? 0} cards and ${pendingBackup?.data.reviewLogs.length ?? 0} review records.`" confirm-label="Import" @confirm="confirmImport">
      <fieldset class="mt-4">
        <legend class="sr-only">How to import</legend>
        <label class="flex min-h-11 items-start gap-3">
          <input v-model="importMode" type="radio" name="import-mode" value="merge" class="mt-1 size-5 accent-[var(--accent)]" />
          <span><span class="font-medium">Merge</span><span class="block text-sm text-muted">Keep what is newer, on this device or in the file.</span></span>
        </label>
        <label class="flex min-h-11 items-start gap-3">
          <input v-model="importMode" type="radio" name="import-mode" value="replace" class="mt-1 size-5 accent-[var(--accent)]" />
          <span><span class="font-medium">Replace</span><span class="block text-sm text-muted">Delete the current progress and use only the file.</span></span>
        </label>
      </fieldset>
    </ConfirmDialog>
  </div>
</template>
