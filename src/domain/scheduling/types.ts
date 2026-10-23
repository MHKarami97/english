export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const RATINGS: readonly Rating[] = ['again', 'hard', 'good', 'easy'];

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface ReviewCard {
  readonly wordId: string;
  readonly bookId: string;
  readonly unitId: string;
  readonly state: CardState;
  readonly ease: number;
  readonly intervalDays: number;
  readonly repetitions: number;
  readonly lapses: number;
  readonly dueAt: number;
  readonly lastReviewedAt: number | null;
  readonly createdAt: number;
}

export interface Interval {
  readonly days: number;
  readonly dueAt: number;
}
