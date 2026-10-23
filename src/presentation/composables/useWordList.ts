import { shallowRef } from 'vue';
import { container } from '@/container';
import type { Knowledge, UserWordState, Word } from '@/domain/entities';
import { useAudio } from './useAudio';

export function useWordList() {
  const states = shallowRef<ReadonlyMap<string, UserWordState>>(new Map());
  const audio = useAudio();

  const remember = (state: UserWordState): void => {
    const copy = new Map(states.value);
    copy.set(state.wordId, state);
    states.value = copy;
  };

  const loadStates = async (words: readonly Word[]): Promise<void> => {
    states.value = await container.progress.statesFor(words);
  };

  const toggleFavorite = async (word: Word): Promise<UserWordState> => {
    const state = await container.progress.toggleFavorite(word);
    remember(state);
    return state;
  };

  const toggleKnown = async (word: Word): Promise<void> => {
    const current = states.value.get(word.id)?.knowledge ?? 'new';
    const next: Knowledge = current === 'known' ? 'unknown' : 'known';
    remember(await container.progress.setKnowledge(word, next));
  };

  const play = (word: Word): void => {
    void audio.play(container.media.audio(word));
  };

  return { states, loadStates, toggleFavorite, toggleKnown, play };
}
