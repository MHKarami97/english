import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { LibrarySnapshot } from '@/application/LibraryService';
import type { ContinueTarget } from '@/application/StudyService';

export const useCatalogStore = defineStore('catalog', () => {
  const snapshot = shallowRef<LibrarySnapshot | null>(null);
  const continueTarget = shallowRef<ContinueTarget | null>(null);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');

  async function load(bookId: string): Promise<void> {
    if (snapshot.value?.units[0]?.unit.bookId !== bookId) snapshot.value = null;
    status.value = snapshot.value ? 'ready' : 'loading';
    try {
      snapshot.value = await container.library.snapshot(bookId);
      status.value = 'ready';
    } catch {
      status.value = 'error';
    }
  }

  async function loadContinue(bookId: string): Promise<void> {
    continueTarget.value = (await container.study.resolveContinue(bookId)) ?? null;
  }

  function invalidate(): void {
    snapshot.value = null;
    continueTarget.value = null;
    status.value = 'idle';
  }

  return { snapshot, continueTarget, status, load, loadContinue, invalidate };
});
