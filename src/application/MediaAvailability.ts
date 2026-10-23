import type { Word } from '@/domain/entities';

/** Answers "can this media be shown right now?" so a question never waits on a missing file. */
export interface MediaAvailability {
  isAudioAvailable(word: Word): Promise<boolean>;
  isImageAvailable(word: Word): Promise<boolean>;
}
