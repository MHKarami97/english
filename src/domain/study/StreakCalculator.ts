export interface StreakResult {
  readonly current: number;
  readonly longest: number;
}

const DAY_MS = 86_400_000;

function toDayNumber(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map(Number);
  return Math.round(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / DAY_MS);
}

/** A streak survives until the end of today's study day, so an inactive today does not break it yet. */
export function calculateStreaks(activeDayKeys: Iterable<string>, todayKey: string): StreakResult {
  const days = [...new Set(activeDayKeys)].map(toDayNumber).sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const day of days) {
    run = day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  const active = new Set(days);
  const today = toDayNumber(todayKey);
  let cursor = active.has(today) ? today : today - 1;
  let current = 0;
  while (active.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest };
}
