import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDY_SETTINGS, sanitizeStudySettings } from '@/domain/study/models';

describe('sanitizeStudySettings', () => {
  it('returns the documented defaults for empty input', () => {
    expect(sanitizeStudySettings({})).toEqual(DEFAULT_STUDY_SETTINGS);
    expect(DEFAULT_STUDY_SETTINGS).toMatchObject({
      newPerDay: 10,
      maxReviewsPerDay: 100,
      dayRolloverHour: 4,
      showIntervalsOnButtons: true,
      activeUnitIds: null,
      newCardOrder: 'unit-order',
      skipKnownWords: true,
    });
  });

  it('clamps out-of-range numbers and rejects non-numbers', () => {
    const result = sanitizeStudySettings({ newPerDay: 500, maxReviewsPerDay: -5, dayRolloverHour: 9 });
    expect(result.newPerDay).toBe(200);
    expect(result.maxReviewsPerDay).toBe(0);
    expect(result.dayRolloverHour).toBe(6);
    expect(sanitizeStudySettings({ newPerDay: Number.NaN, dayRolloverHour: '3' }).newPerDay).toBe(10);
    expect(sanitizeStudySettings({ dayRolloverHour: '3' }).dayRolloverHour).toBe(4);
  });

  it('validates enums, booleans and the unit list', () => {
    expect(sanitizeStudySettings({ newCardOrder: 'chaos' }).newCardOrder).toBe('unit-order');
    expect(sanitizeStudySettings({ newCardOrder: 'random' }).newCardOrder).toBe('random');
    expect(sanitizeStudySettings({ skipKnownWords: 'yes' }).skipKnownWords).toBe(true);
    expect(sanitizeStudySettings({ activeUnitIds: ['a', 3, 'b'] }).activeUnitIds).toEqual(['a', 'b']);
    expect(sanitizeStudySettings({ activeUnitIds: 'a' }).activeUnitIds).toBeNull();
  });
});
