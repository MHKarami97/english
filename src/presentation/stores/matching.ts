import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { MatchingGame, MatchingView } from '@/application/MatchingGame';
import type { PracticeScope } from '@/domain/quiz/models';

export const useMatchingStore = defineStore('matching', () => {
  const view = shallowRef<MatchingView | null>(null);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let game: MatchingGame | null = null;

  async function start(bookId: string, scope: PracticeScope, variant: 'definition' | 'image'): Promise<void> {
    status.value = 'loading';
    try {
      game = container.createMatching();
      view.value = await game.start(bookId, scope, variant);
      status.value = 'ready';
    } catch {
      status.value = 'error';
    }
  }

  async function attempt(leftId: string, rightId: string): Promise<boolean> {
    if (!game) return false;
    const correct = await game.attempt(leftId, rightId);
    view.value = game.view();
    return correct;
  }

  async function nextRound(): Promise<void> {
    if (game) view.value = await game.nextRound();
  }

  async function finish(): Promise<void> {
    if (game) view.value = await game.finish();
  }

  return { view, status, start, attempt, nextRound, finish };
});
