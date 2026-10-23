import { INITIAL_EASE } from './Sm2Scheduler';
import type { ReviewCard } from './types';

export interface CardTarget {
  readonly wordId: string;
  readonly bookId: string;
  readonly unitId: string;
}

export function createNewCard(target: CardTarget, now: number): ReviewCard {
  return {
    wordId: target.wordId,
    bookId: target.bookId,
    unitId: target.unitId,
    state: 'new',
    ease: INITIAL_EASE,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
  };
}
