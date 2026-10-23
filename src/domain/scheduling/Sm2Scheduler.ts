import type { StudyCalendar } from '../study/StudyCalendar';
import { RATING_QUALITY } from './ratingMap';
import type { SchedulerStrategy } from './SchedulerStrategy';
import { RATINGS, type CardState, type Interval, type Rating, type ReviewCard } from './types';

export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;
const SECOND_INTERVAL_DAYS = 6;

// The original SM-2 text rounds fractional intervals up; the extra rounding removes float noise first.
const roundInterval = (value: number): number => Math.ceil(Math.round(value * 1e6) / 1e6);
const roundEase = (value: number): number => Math.round(value * 100) / 100;

export function nextEase(ease: number, quality: number): number {
  const gap = 5 - quality;
  return Math.max(MIN_EASE, roundEase(ease + (0.1 - gap * (0.08 + gap * 0.02))));
}

function nextState(previous: CardState, failed: boolean): CardState {
  if (!failed) return 'review';
  return previous === 'review' || previous === 'relearning' ? 'relearning' : 'learning';
}

/**
 * SuperMemo SM-2. The ease factor is updated on every answer before the new interval is
 * computed; a grade below 3 restarts the repetition sequence but keeps the updated ease.
 */
export class Sm2Scheduler implements SchedulerStrategy {
  constructor(
    private readonly calendar: StudyCalendar,
    private readonly qualities: Readonly<Record<Rating, number>> = RATING_QUALITY,
  ) {}

  schedule(card: ReviewCard, rating: Rating, now: Date): ReviewCard {
    const quality = this.qualities[rating];
    const failed = quality < 3;
    // A clock moved backwards must never schedule a card before its previous review.
    const reviewedAt = Math.max(now.getTime(), card.lastReviewedAt ?? 0);
    const ease = nextEase(card.ease, quality);
    const repetitions = failed ? 0 : card.repetitions + 1;
    const intervalDays = failed ? 1 : this.passInterval(repetitions, card.intervalDays, ease);

    return {
      ...card,
      state: nextState(card.state, failed),
      ease,
      intervalDays,
      repetitions,
      lapses: card.lapses + (failed && card.state === 'review' ? 1 : 0),
      dueAt: this.calendar.dueAt(reviewedAt, intervalDays),
      lastReviewedAt: reviewedAt,
    };
  }

  previewIntervals(card: ReviewCard, now: Date): Record<Rating, Interval> {
    const preview = {} as Record<Rating, Interval>;
    for (const rating of RATINGS) {
      const next = this.schedule(card, rating, now);
      preview[rating] = { days: next.intervalDays, dueAt: next.dueAt };
    }
    return preview;
  }

  private passInterval(repetitions: number, previousDays: number, ease: number): number {
    if (repetitions === 1) return 1;
    if (repetitions === 2) return SECOND_INTERVAL_DAYS;
    return Math.max(SECOND_INTERVAL_DAYS, roundInterval(previousDays * ease));
  }
}
