import { shallowRef } from 'vue';
import { container } from '@/container';
import type { AudioState } from '@/infrastructure/audio/AudioPlayer';

const state = shallowRef<AudioState>(container.audio.getState());
container.audio.subscribe((next) => {
  state.value = next;
});

export function useAudio() {
  const play = (url: string | null): Promise<boolean> => (url ? container.audio.play(url) : Promise.resolve(false));
  return { state, play, stop: () => container.audio.stop() };
}
