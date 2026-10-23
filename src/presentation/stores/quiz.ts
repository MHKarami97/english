import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { QuizRequest, QuizSessionService, QuizSummary, QuizView } from '@/application/QuizSessionService';

export const useQuizStore = defineStore('quiz', () => {
  // The view is replaced once per action; the countdown lives in its own ref so a tick never re-renders the question.
  const view = shallowRef<QuizView | null>(null);
  const summary = shallowRef<QuizSummary | null>(null);
  const remainingMs = ref<number | null>(null);
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let service: QuizSessionService | null = null;
  let ticker: ReturnType<typeof setInterval> | undefined;

  async function start(request: QuizRequest): Promise<void> {
    await open(async (created) => created.start(request));
  }

  async function resume(bookId: string): Promise<boolean> {
    let restored = false;
    await open(async (created) => {
      const resumed = await created.resume(bookId);
      restored = resumed !== null;
      return resumed ?? created.view();
    });
    return restored;
  }

  async function open(run: (created: QuizSessionService) => Promise<QuizView>): Promise<void> {
    stopTimer();
    status.value = 'loading';
    summary.value = null;
    try {
      service = container.createQuiz();
      await adopt(await run(service));
      status.value = 'ready';
      startTimer();
    } catch {
      status.value = 'error';
    }
  }

  async function adopt(next: QuizView): Promise<void> {
    view.value = next;
    remainingMs.value = next.remainingMs;
    if (next.status === 'finished' && service) {
      stopTimer();
      summary.value = await service.summary();
    } else if (next.current?.question.type === 'dictation' && next.autoPlayAudio) {
      playTarget();
    }
  }

  async function answer(text: string): Promise<void> {
    if (service) await adopt(await service.answer(text));
  }

  async function skip(): Promise<void> {
    if (service) await adopt(await service.skip());
  }

  async function next(): Promise<void> {
    if (service) await adopt(await service.next());
  }

  function playTarget(): void {
    const target = view.value?.current?.target;
    const url = target ? container.media.audio(target) : null;
    if (url) void container.audio.play(url);
  }

  async function tick(): Promise<void> {
    if (!service) return;
    remainingMs.value = service.remainingMs();
    const expired = await service.expireIfNeeded();
    if (expired) await adopt(expired);
  }

  // Page Visibility API: a hidden tab must not burn the timed challenge's clock.
  function onVisibility(): void {
    if (!service) return;
    if (document.visibilityState === 'hidden') service.pause();
    else service.resumeTimer();
  }

  function startTimer(): void {
    if (!view.value?.timed || view.value.status === 'finished') return;
    ticker = setInterval(() => void tick(), 250);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function stopTimer(): void {
    clearInterval(ticker);
    ticker = undefined;
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function leave(): void {
    stopTimer();
    container.audio.stop();
  }

  return { view, summary, remainingMs, status, start, resume, answer, skip, next, playTarget, leave };
});
