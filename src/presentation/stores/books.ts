import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import { SettingKey } from '@/application/settingKeys';
import type { ImportProgress } from '@/domain/contracts';
import type { BookRef } from '@/domain/entities';

export type BootPhase = 'idle' | 'loading' | 'importing' | 'ready' | 'error';

export const useBooksStore = defineStore('books', () => {
  const books = shallowRef<readonly BookRef[]>([]);
  const activeBookId = ref<string | null>(null);
  const phase = ref<BootPhase>('idle');
  const progress = ref<ImportProgress | null>(null);
  const errorKind = ref<'offline' | 'failed'>('failed');
  const dataVersion = ref(0);
  const activeBook = computed(() => books.value.find((book) => book.id === activeBookId.value) ?? null);

  const onRefreshed = (): void => {
    container.search.invalidate();
    dataVersion.value += 1;
  };

  async function bootstrap(): Promise<void> {
    phase.value = 'loading';
    try {
      const refs = await container.bootstrap.loadBookRefs();
      container.media.register(refs);
      books.value = refs;

      const stored = await container.settings.get<string | null>(SettingKey.activeBookId, null);
      const active = refs.find((book) => book.id === stored) ?? refs[0];
      if (!active) throw new Error('books.json does not list any book');
      activeBookId.value = active.id;

      await container.bootstrap.ensureBook(active, {
        onRefreshed,
        onProgress: (update) => {
          phase.value = 'importing';
          progress.value = update;
        },
      });
      phase.value = 'ready';

      for (const other of refs) {
        if (other.id !== active.id) void container.bootstrap.ensureBook(other, { onRefreshed }).catch(() => undefined);
      }
    } catch {
      errorKind.value = navigator.onLine ? 'failed' : 'offline';
      phase.value = 'error';
    }
  }

  async function setActive(bookId: string): Promise<void> {
    if (activeBookId.value === bookId) return;
    activeBookId.value = bookId;
    await container.settings.set(SettingKey.activeBookId, bookId);
  }

  return { books, activeBookId, activeBook, phase, progress, errorKind, dataVersion, bootstrap, setActive };
});
