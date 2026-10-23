import type { Interval, Rating, ReviewCard } from './types';

/** Strategy seam: a future FsrsScheduler can replace Sm2Scheduler without touching callers. */
export interface SchedulerStrategy {
  schedule(card: ReviewCard, rating: Rating, now: Date): ReviewCard;
  previewIntervals(card: ReviewCard, now: Date): Record<Rating, Interval>;
}
