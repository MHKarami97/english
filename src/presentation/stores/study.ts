import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { container } from '@/container';
import type { StudySession } from '@/application/StudyService';
import type { Knowledge, UserWordState, Word } from '@/domain/entities';
import { useSettingsStore } from './settings';

export type StudyStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export const useStudyStore = defineStore('study', () => {
  const settings = useSettingsStore();
  const title = ref('');
  const status = ref<StudyStatus>('idle');
  const words = shallowRef<readonly Word[]>([]);
  const states = shallowRef<ReadonlyMap<string, UserWordState>>(new Map());
  const index = ref(0);
  const flipped = ref(false);
  const finished = ref(false);

  const current = computed(() => words.value[index.value] ?? null);
  const next = computed(() => words.value[index.value + 1] ?? null);
  const currentState = computed(() => (current.value ? (states.value.get(current.value.id) ?? null) : null));
  const knownCount = computed(() => words.value.filter((word) => states.value.get(word.id)?.knowledge === 'known').length);

  function settle(): void {
    const word = current.value;
    if (!word) return;
    void container.study.savePosition({ bookId: word.bookId, unitId: word.unitId, wordId: word.id });
    for (const candidate of [word, next.value]) {
      if (!candidate) continue;
      container.audio.preload(container.media.audio(candidate));
      container.media.preloadImage(container.media.wordImage(candidate));
    }
  }

  async function open(load: () => Promise<StudySession | undefined>, startWordId?: string): Promise<void> {
    status.value = 'loading';
    flipped.value = false;
    finished.value = false;
    try {
      const session = await load();
      title.value = session?.title ?? '';
      if (!session || session.words.length === 0) {
        words.value = [];
        status.value = 'empty';
        return;
      }
      words.value = session.words;
      states.value = await container.progress.statesFor(session.words);
      index.value = Math.max(0, startWordId ? session.words.findIndex((word) => word.id === startWordId) : 0);
      status.value = 'ready';
      settle();
    } catch {
      status.value = 'error';
    }
  }

  function goTo(target: number): void {
    if (target < 0 || target >= words.value.length) return;
    index.value = target;
    flipped.value = false;
    finished.value = false;
    settle();
  }

  function playCurrent(): void {
    const url = current.value ? container.media.audio(current.value) : null;
    if (url) void container.audio.play(url);
  }

  function flip(): void {
    flipped.value = !flipped.value;
    if (flipped.value && settings.autoPlayOnFlip) playCurrent();
  }

  function remember(state: UserWordState): void {
    const copy = new Map(states.value);
    copy.set(state.wordId, state);
    states.value = copy;
  }

  async function mark(knowledge: Knowledge): Promise<void> {
    const word = current.value;
    if (!word) return;
    remember(await container.progress.setKnowledge(word, knowledge));
    if (index.value < words.value.length - 1) goTo(index.value + 1);
    else finished.value = true;
  }

  async function toggleFavorite(): Promise<void> {
    const word = current.value;
    if (word) remember(await container.progress.toggleFavorite(word));
  }

  function restart(): void {
    goTo(0);
    finished.value = false;
  }

  function leave(): void {
    container.audio.stop();
  }

  return {
    title, status, words, index, flipped, finished, current, next, currentState, knownCount,
    open, goTo, flip, mark, toggleFavorite, playCurrent, restart, leave,
  };
});
