import { describe, expect, it } from 'vitest';
import { shouldRemindBackup } from '@/domain/backup/reminder';

const DAY = 24 * 60 * 60 * 1000;
const base = { firstReviewAt: 0, lastExportAt: null, dismissedAt: null, days: 14 };

describe('shouldRemindBackup', () => {
  it('stays quiet when there is no review history', () => {
    expect(shouldRemindBackup({ ...base, firstReviewAt: null, now: 100 * DAY })).toBe(false);
  });

  it('stays quiet before the period is over and speaks up after it', () => {
    expect(shouldRemindBackup({ ...base, now: 13 * DAY })).toBe(false);
    expect(shouldRemindBackup({ ...base, now: 14 * DAY })).toBe(true);
  });

  it('counts from the last export', () => {
    expect(shouldRemindBackup({ ...base, lastExportAt: 10 * DAY, now: 20 * DAY })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastExportAt: 10 * DAY, now: 24 * DAY })).toBe(true);
  });

  it('counts from the last dismissal', () => {
    expect(shouldRemindBackup({ ...base, dismissedAt: 6 * DAY, now: 19 * DAY })).toBe(false);
    expect(shouldRemindBackup({ ...base, dismissedAt: 6 * DAY, now: 20 * DAY })).toBe(true);
  });
});
