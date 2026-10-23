import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { SessionSummary, SessionView, StudySessionService } from '@/application/StudySessionService';
import type { Rating } from '@/domain/scheduling/types';
import type { StreakResult } from '@/domain/study/StreakCalculator';
import { useSettingsStore } from './settings';

const PERSIST_REQUESTED_KEY = 'persistRequested';

export const useReviewStore = defineStore('review', () => {
  const settings = useSettingsStore();
  // Replaced as a whole once per action, so a card change costs a single re-render.
  const view = shallowRef<SessionView | null>(null);
  const summary = shallowRef<SessionSummary | null>(null);
  const streak = shallowRef<StreakResult | null>(null);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let session: StudySessionService | null = null;

  async function start(bookId: string, extraNew?: number): Promise<void> {
    status.value = 'loading';
    summary.value = null;
    try {
      session = container.createSession();
      view.value = await session.start(bookId, { extraNew });
      status.value = 'ready';
      await settleIfFinished();
    } catch {
      status.value = 'error';
    }
  }

  function playCurrent(): void {
    const word = view.value?.current?.word;
    const url = word ? container.media.audio(word) : null;
    if (url) void container.audio.play(url);
  }

  function reveal(): void {
    if (!session || view.value?.revealed) return;
    view.value = session.reveal();
    if (settings.autoPlayOnFlip) playCurrent();
  }

  async function answer(rating: Rating): Promise<void> {
    if (!session) return;
    view.value = await session.answer(rating);
    await settleIfFinished();
  }

  async function undo(): Promise<void> {
    if (!session) return;
    view.value = await session.undo();
    await settleIfFinished();
  }

  function leave(): void {
    container.audio.stop();
  }

  async function settleIfFinished(): Promise<void> {
    if (!session || view.value?.status !== 'finished') {
      summary.value = null;
      return;
    }
    const rollover = (await container.studySettings.load()).dayRolloverHour;
    summary.value = await session.summary();
    streak.value = await container.streak.current(rollover);
    if (summary.value.answered > 0) await requestPersistenceOnce();
  }

  /** Asked once, after the first completed session, when the user has visibly invested in the data. */
  async function requestPersistenceOnce(): Promise<void> {
    if (await container.settings.get(PERSIST_REQUESTED_KEY, false)) return;
    await container.settings.set(PERSIST_REQUESTED_KEY, true);
    await container.storage.persist();
  }

  return { view, summary, streak, status, start, reveal, answer, undo, playCurrent, leave };
});
