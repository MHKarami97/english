import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { MistakeEntry, PracticeHub } from '@/application/PracticeHubService';

export const usePracticeStore = defineStore('practice', () => {
  const hub = shallowRef<PracticeHub | null>(null);
  const mistakes = shallowRef<readonly MistakeEntry[]>([]);

  async function load(bookId: string): Promise<void> {
    hub.value = await container.practiceHub.load(bookId);
  }

  async function loadMistakes(): Promise<void> {
    mistakes.value = await container.practiceHub.mistakeEntries(200);
  }

  async function dismissPrompt(): Promise<void> {
    await container.practiceHub.dismissPlacementPrompt();
    if (hub.value) hub.value = { ...hub.value, promptDismissed: true };
  }

  return { hub, mistakes, load, loadMistakes, dismissPrompt };
});
