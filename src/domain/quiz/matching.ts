import type { Word } from '../entities';
import { shuffle, type RandomSource } from '../random';
import type { MatchingQuestion } from './questions';

export const MATCHING_PAIRS_PER_ROUND = 6;

export function buildMatchingRound(
  roundId: string,
  words: readonly Word[],
  variant: MatchingQuestion['variant'],
  random: RandomSource,
): MatchingQuestion {
  const ids = words.map((word) => word.id);
  return {
    id: roundId,
    type: 'matching',
    variant,
    pairs: words.map((word) => ({ wordId: word.id, label: word.word, definition: word.definition })),
    leftOrder: shuffle(ids, random),
    rightOrder: shuffle(ids, random),
  };
}
