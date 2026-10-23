import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { TodaySummary } from '@/application/TodayService';

export const useTodayStore = defineStore('today', () => {
  const summary = shallowRef<TodaySummary | null>(null);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');

  async function load(bookId: string): Promise<void> {
    status.value = summary.value ? 'ready' : 'loading';
    try {
      summary.value = await container.today.summary(bookId);
      status.value = 'ready';
    } catch {
      status.value = 'error';
    }
  }

  return { summary, status, load };
});
