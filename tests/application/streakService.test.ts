import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudyDayService } from '@/application/StudyDayService';
import type { LexiDatabase } from '@/data/db/LexiDatabase';
import { FixedClock } from '../helpers/clock';
import { dropDb, openTestDb } from '../helpers/database';
import { createStudyKit } from '../helpers/studyKit';

let db: LexiDatabase;
let clock: FixedClock;
let kit: ReturnType<typeof createStudyKit>;

const day = (dateKey: string, newCount: number, reviewCount: number) => ({
  dateKey,
  newCount,
  reviewCount,
  againCount: 0,
  totalDurationMs: 0,
});

beforeEach(async () => {
  db = await openTestDb();
  clock = new FixedClock(Date.UTC(2026, 2, 10, 2, 0));
  kit = createStudyKit(db, clock);
});

afterEach(async () => {
  await dropDb(db);
});

describe('StreakService', () => {
  it('counts days with new or review activity and keeps the streak alive before today is studied', async () => {
    await db.dailyStats.bulkPut([day('2026-03-06', 0, 4), day('2026-03-07', 3, 0), day('2026-03-08', 1, 1), day('2026-03-04', 0, 0)]);
    // 02:00 UTC is before the 04:00 rollover, so the study day is still 2026-03-09.
    expect(await kit.streak.current(4)).toEqual({ current: 3, longest: 3 });
  });

  it('breaks after a fully missed study day and remembers the longest run', async () => {
    await db.dailyStats.bulkPut([day('2026-03-01', 1, 0), day('2026-03-02', 1, 0), day('2026-03-03', 1, 0), day('2026-03-07', 1, 0)]);
    clock.set(Date.UTC(2026, 2, 10, 5, 0));
    expect(await kit.streak.current(4)).toEqual({ current: 0, longest: 3 });
  });

  it('does not count a day with only zero counters', async () => {
    await db.dailyStats.put(day('2026-03-09', 0, 0));
    expect((await kit.streak.current(4)).current).toBe(0);
  });
});

describe('StudyDayService', () => {
  it('follows the rollover hour in Europe/Amsterdam around the DST change', () => {
    const clockAtChange = new FixedClock(Date.UTC(2026, 2, 29, 1, 59));
    const service = new StudyDayService(clockAtChange, 'Europe/Amsterdam');
    expect(service.todayKey(4)).toBe('2026-03-28');
    clockAtChange.set(Date.UTC(2026, 2, 29, 2, 0));
    expect(service.todayKey(4)).toBe('2026-03-29');
    expect(service.endOfToday(4)).toBe(Date.UTC(2026, 2, 30, 2, 0));
  });

  it('uses the +03:30 offset in Asia/Tehran and tolerates a clock moved backwards', () => {
    const movable = new FixedClock(Date.UTC(2026, 5, 10, 0, 30));
    const service = new StudyDayService(movable, 'Asia/Tehran');
    expect(service.todayKey(4)).toBe('2026-06-10');
    movable.set(Date.UTC(2026, 5, 9, 12, 0));
    expect(service.todayKey(4)).toBe('2026-06-09');
  });
});
