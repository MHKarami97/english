<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { container } from '@/container';
import type { StorageUsage } from '@/infrastructure/storage/StorageEstimator';
import { useCatalogStore } from '@/presentation/stores/catalog';
import { useSettingsStore, type ThemeChoice } from '@/presentation/stores/settings';

const settings = useSettingsStore();
const catalog = useCatalogStore();
const dialog = ref<HTMLDialogElement | null>(null);
const usage = ref<StorageUsage | null>(null);
const message = ref('');

const themes: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const formatBytes = (bytes: number): string =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

onMounted(async () => {
  usage.value = await container.storage.estimate();
});

async function confirmReset(): Promise<void> {
  await container.progress.resetAll();
  catalog.invalidate();
  dialog.value?.close();
  message.value = 'Your progress was cleared. The word lists are still saved.';
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
    <h1 class="mb-8 font-display text-title font-semibold">Settings</h1>

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

    <section class="mb-8" aria-labelledby="storage-title">
      <h2 id="storage-title" class="mb-2 font-medium">Storage on this device</h2>
      <p v-if="usage" class="text-sm text-muted">{{ formatBytes(usage.usage) }} used of about {{ formatBytes(usage.quota) }} available.</p>
      <p v-else class="text-sm text-muted">Your browser does not report storage usage.</p>
    </section>

    <section class="mb-8" aria-labelledby="reset-heading">
      <h2 id="reset-heading" class="mb-1 font-medium">Reset my progress</h2>
      <p class="mb-3 text-sm text-muted">Clears known and unknown marks, favorites and your last position.</p>
      <button type="button" class="btn" @click="dialog?.showModal()">Reset my progress</button>
      <p v-if="message" class="mt-3 text-sm" role="status">{{ message }}</p>
    </section>

    <p class="text-sm text-muted">Version {{ __APP_VERSION__ }}</p>

    <dialog ref="dialog" class="dialog" aria-labelledby="reset-title">
      <div class="p-6">
        <h2 id="reset-title" class="font-display text-xl font-semibold">Reset your progress?</h2>
        <p class="mt-2 text-muted">This cannot be undone. Your saved word lists stay on the device.</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="btn" @click="dialog?.close()">Cancel</button>
          <button type="button" class="btn btn-primary" @click="confirmReset">Reset progress</button>
        </div>
      </div>
    </dialog>
  </div>
</template>
