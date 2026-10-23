import { describe, expect, it } from 'vitest';
import { ZonedStudyCalendar } from '@/domain/study/ZonedStudyCalendar';

const HOUR = 3_600_000;
const utc = (year: number, month: number, day: number, hour = 0, minute = 0): number =>
  Date.UTC(year, month - 1, day, hour, minute);

const amsterdam = new ZonedStudyCalendar('Europe/Amsterdam', 4);
const tehran = new ZonedStudyCalendar('Asia/Tehran', 4);

describe('rollover boundary', () => {
  it('keeps 03:59 local time in the previous study day', () => {
    expect(amsterdam.dayKey(utc(2026, 6, 10, 1, 59))).toBe('2026-06-09');
    expect(amsterdam.dayKey(utc(2026, 6, 10, 2, 0))).toBe('2026-06-10');
  });

  it('honours the configured rollover hour', () => {
    expect(new ZonedStudyCalendar('UTC', 0).dayKey(utc(2026, 6, 10, 0, 0))).toBe('2026-06-10');
    expect(new ZonedStudyCalendar('UTC', 6).dayKey(utc(2026, 6, 10, 5, 59))).toBe('2026-06-09');
  });

  it('crosses month and year boundaries', () => {
    expect(new ZonedStudyCalendar('UTC', 4).dayKey(utc(2026, 1, 1, 3, 0))).toBe('2025-12-31');
  });

  it('adds calendar days across months and leap years', () => {
    expect(amsterdam.addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(amsterdam.addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('Europe/Amsterdam DST', () => {
  it('has a 23 hour study day when clocks go forward (2026-03-29)', () => {
    expect(amsterdam.startOfDay('2026-03-29')).toBe(utc(2026, 3, 29, 2, 0));
    expect(amsterdam.startOfDay('2026-03-29') - amsterdam.startOfDay('2026-03-28')).toBe(23 * HOUR);
    expect(amsterdam.dayKey(utc(2026, 3, 29, 1, 59))).toBe('2026-03-28');
    expect(amsterdam.dayKey(utc(2026, 3, 29, 2, 0))).toBe('2026-03-29');
  });

  it('has a 25 hour study day when clocks go back (2026-10-25)', () => {
    expect(amsterdam.startOfDay('2026-10-25') - amsterdam.startOfDay('2026-10-24')).toBe(25 * HOUR);
    expect(amsterdam.dayKey(utc(2026, 10, 25, 2, 59))).toBe('2026-10-24');
    expect(amsterdam.dayKey(utc(2026, 10, 25, 3, 0))).toBe('2026-10-25');
  });

  it('schedules a one day interval to the next rollover across the change', () => {
    expect(amsterdam.dueAt(utc(2026, 3, 28, 20, 0), 1)).toBe(utc(2026, 3, 29, 2, 0));
  });
});

describe('Asia/Tehran', () => {
  it('uses the fixed +03:30 offset today', () => {
    expect(tehran.dayKey(utc(2026, 6, 10, 0, 29))).toBe('2026-06-09');
    expect(tehran.dayKey(utc(2026, 6, 10, 0, 30))).toBe('2026-06-10');
    expect(tehran.startOfDay('2026-06-10')).toBe(utc(2026, 6, 10, 0, 30));
  });

  it('has no daylight saving change in 2026', () => {
    expect(tehran.startOfDay('2026-03-22') - tehran.startOfDay('2026-03-21')).toBe(24 * HOUR);
    expect(tehran.startOfDay('2026-09-22') - tehran.startOfDay('2026-09-21')).toBe(24 * HOUR);
  });

  it('still handles the last daylight saving change in September 2022', () => {
    expect(tehran.startOfDay('2022-09-22') - tehran.startOfDay('2022-09-21')).toBe(25 * HOUR);
  });
});
