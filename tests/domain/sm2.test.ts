import { describe, expect, it } from 'vitest';
import { createNewCard } from '@/domain/scheduling/createNewCard';
import { formatInterval } from '@/domain/scheduling/formatInterval';
import { MIN_EASE, Sm2Scheduler, nextEase } from '@/domain/scheduling/Sm2Scheduler';
import type { Rating, ReviewCard } from '@/domain/scheduling/types';
import { ZonedStudyCalendar } from '@/domain/study/ZonedStudyCalendar';

const calendar = new ZonedStudyCalendar('UTC', 0);
const scheduler = new Sm2Scheduler(calendar);
const start = Date.UTC(2026, 0, 1, 10, 0);
const day = 86_400_000;

const freshCard = (): ReviewCard => createNewCard({ wordId: 'b:1:1', bookId: 'b', unitId: 'b:1' }, start);

function play(ratings: readonly Rating[]): ReviewCard {
  let card = freshCard();
  let now = start;
  for (const rating of ratings) {
    card = scheduler.schedule(card, rating, new Date(now));
    now = card.dueAt;
  }
  return card;
}

describe('Sm2Scheduler intervals', () => {
  it('follows 1 day, 6 days, then previous * ease rounded up', () => {
    expect(play(['good']).intervalDays).toBe(1);
    expect(play(['good', 'good']).intervalDays).toBe(6);
    expect(play(['good', 'good', 'good']).intervalDays).toBe(15);
    expect(play(['good', 'good', 'good', 'good']).intervalDays).toBe(38);
  });

  it('schedules the card at the start of the study day that many days later', () => {
    const card = scheduler.schedule(freshCard(), 'good', new Date(start));
    expect(card.dueAt).toBe(Date.UTC(2026, 0, 2));
    expect(card.lastReviewedAt).toBe(start);
    expect(card.dueAt - start).toBeLessThan(day);
  });

  it('raises ease on Easy and lengthens intervals faster', () => {
    const card = play(['easy', 'easy', 'easy']);
    expect(card.ease).toBe(2.8);
    expect(card.intervalDays).toBe(17);
  });
});

describe('ease factor', () => {
  it('applies the SM-2 formula', () => {
    expect(nextEase(2.5, 5)).toBe(2.6);
    expect(nextEase(2.5, 4)).toBe(2.5);
    expect(nextEase(2.5, 3)).toBe(2.36);
    expect(nextEase(2.5, 1)).toBe(1.96);
    expect(nextEase(2.5, 0)).toBe(1.7);
  });

  it('never goes below 1.3', () => {
    expect(nextEase(1.3, 0)).toBe(MIN_EASE);
    expect(play(Array<Rating>(10).fill('again')).ease).toBe(MIN_EASE);
  });
});

describe('lapses', () => {
  it('resets repetitions, returns to one day and counts the lapse', () => {
    const lapsed = scheduler.schedule(play(['good', 'good', 'good']), 'again', new Date(start + 30 * day));
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.ease).toBe(1.96);
  });

  it('restarts the 1 day, 6 days sequence after a lapse', () => {
    const card = play(['good', 'good', 'good', 'again', 'good', 'good']);
    expect(card.intervalDays).toBe(6);
    expect(card.state).toBe('review');
  });

  it('does not count a failed first answer or a repeated relearning failure as a lapse', () => {
    expect(play(['again']).lapses).toBe(0);
    expect(play(['again']).state).toBe('learning');
    expect(play(['good', 'again', 'again']).lapses).toBe(1);
  });
});

describe('previewIntervals', () => {
  it('matches what schedule() would produce for every button', () => {
    const card = play(['good', 'good']);
    const preview = scheduler.previewIntervals(card, new Date(card.dueAt));
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      const scheduled = scheduler.schedule(card, rating, new Date(card.dueAt));
      expect(preview[rating]).toEqual({ days: scheduled.intervalDays, dueAt: scheduled.dueAt });
    }
    expect(preview.again.days).toBe(1);
    expect(preview.easy.days).toBeGreaterThanOrEqual(preview.good.days);
    expect(preview.good.days).toBeGreaterThanOrEqual(preview.hard.days);
  });

  it('shows one day on every button for a brand new card (pure SM-2)', () => {
    const preview = scheduler.previewIntervals(freshCard(), new Date(start));
    expect(Object.values(preview).map((interval) => interval.days)).toEqual([1, 1, 1, 1]);
  });
});

describe('robustness', () => {
  it('never schedules before the previous review when the clock moves backwards', () => {
    const reviewed = play(['good']);
    const result = scheduler.schedule(reviewed, 'good', new Date(start - 10 * day));
    expect(result.lastReviewedAt).toBe(reviewed.lastReviewedAt);
    expect(result.dueAt).toBeGreaterThan(reviewed.dueAt);
  });

  it('accepts a custom rating map', () => {
    const strict = new Sm2Scheduler(calendar, { again: 0, hard: 2, good: 4, easy: 5 });
    const card = strict.schedule(freshCard(), 'hard', new Date(start));
    expect(card.repetitions).toBe(0);
    expect(card.state).toBe('learning');
  });
});

describe('formatInterval', () => {
  it('formats days, months and years', () => {
    expect(formatInterval(1)).toBe('1d');
    expect(formatInterval(29)).toBe('29d');
    expect(formatInterval(38)).toBe('1.3mo');
    expect(formatInterval(400)).toBe('1.1y');
  });
});
