import type { DailyStats, ReviewLog } from './models';

/** Applies (direction 1) or reverts (direction -1) one review log to a day's counters. */
export function applyLog(stats: DailyStats, log: ReviewLog, direction: 1 | -1): DailyStats {
  const introducedNew = log.previousState === 'new';
  const change = (value: number, delta: number): number => Math.max(0, value + direction * delta);
  return {
    dateKey: stats.dateKey,
    newCount: change(stats.newCount, introducedNew ? 1 : 0),
    reviewCount: change(stats.reviewCount, introducedNew ? 0 : 1),
    againCount: change(stats.againCount, log.rating === 'again' ? 1 : 0),
    totalDurationMs: change(stats.totalDurationMs, log.durationMs),
  };
}
