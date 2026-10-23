import { describe, expect, it } from 'vitest';
import { calculateStreaks } from '@/domain/study/StreakCalculator';

describe('calculateStreaks', () => {
  it('returns zeros without activity', () => {
    expect(calculateStreaks([], '2026-03-05')).toEqual({ current: 0, longest: 0 });
  });

  it('counts a run that ends today and tracks the longest earlier run', () => {
    const days = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05'];
    expect(calculateStreaks(days, '2026-03-05')).toEqual({ current: 1, longest: 3 });
  });

  it('keeps the streak alive until the end of today when only yesterday is active', () => {
    const days = ['2026-03-03', '2026-03-04', '2026-03-05'];
    expect(calculateStreaks(days, '2026-03-06').current).toBe(3);
  });

  it('breaks the streak after a fully missed day', () => {
    expect(calculateStreaks(['2026-03-03', '2026-03-04', '2026-03-05'], '2026-03-07').current).toBe(0);
  });

  it('ignores duplicates and handles month and leap-day boundaries', () => {
    expect(calculateStreaks(['2026-02-27', '2026-02-28', '2026-02-28', '2026-03-01'], '2026-03-01').current).toBe(3);
    expect(calculateStreaks(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01').longest).toBe(3);
  });

  it('does not count future days toward the current streak when the clock moved backwards', () => {
    expect(calculateStreaks(['2026-03-10', '2026-03-11'], '2026-03-05').current).toBe(0);
  });
});
