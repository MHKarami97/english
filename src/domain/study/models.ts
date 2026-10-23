import type { CardState, Rating } from '../scheduling/types';

export interface ReviewLog {
  readonly id?: number;
  readonly wordId: string;
  readonly bookId: string;
  readonly rating: Rating;
  readonly previousState: CardState;
  readonly previousInterval: number;
  readonly newInterval: number;
  readonly easeBefore: number;
  readonly easeAfter: number;
  readonly reviewedAt: number;
  readonly durationMs: number;
}

export interface DailyStats {
  readonly dateKey: string;
  readonly newCount: number;
  readonly reviewCount: number;
  readonly againCount: number;
  readonly totalDurationMs: number;
}

export const emptyDailyStats = (dateKey: string): DailyStats => ({
  dateKey,
  newCount: 0,
  reviewCount: 0,
  againCount: 0,
  totalDurationMs: 0,
});

export type NewCardOrder = 'unit-order' | 'random';

export interface StudySettings {
  readonly newPerDay: number;
  readonly maxReviewsPerDay: number;
  readonly dayRolloverHour: number;
  readonly showIntervalsOnButtons: boolean;
  /** null means every unit is active. */
  readonly activeUnitIds: readonly string[] | null;
  readonly newCardOrder: NewCardOrder;
  readonly skipKnownWords: boolean;
}

export const STUDY_SETTING_LIMITS = {
  newPerDay: { min: 0, max: 200 },
  maxReviewsPerDay: { min: 0, max: 1000 },
  dayRolloverHour: { min: 0, max: 6 },
} as const;

export const DEFAULT_STUDY_SETTINGS: StudySettings = {
  newPerDay: 10,
  maxReviewsPerDay: 100,
  dayRolloverHour: 4,
  showIntervalsOnButtons: true,
  activeUnitIds: null,
  newCardOrder: 'unit-order',
  skipKnownWords: true,
};

function clampInt(value: unknown, limits: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

export function sanitizeStudySettings(input: Partial<Record<keyof StudySettings, unknown>>): StudySettings {
  const defaults = DEFAULT_STUDY_SETTINGS;
  const units = input.activeUnitIds;
  return {
    newPerDay: clampInt(input.newPerDay, STUDY_SETTING_LIMITS.newPerDay, defaults.newPerDay),
    maxReviewsPerDay: clampInt(input.maxReviewsPerDay, STUDY_SETTING_LIMITS.maxReviewsPerDay, defaults.maxReviewsPerDay),
    dayRolloverHour: clampInt(input.dayRolloverHour, STUDY_SETTING_LIMITS.dayRolloverHour, defaults.dayRolloverHour),
    showIntervalsOnButtons:
      typeof input.showIntervalsOnButtons === 'boolean' ? input.showIntervalsOnButtons : defaults.showIntervalsOnButtons,
    activeUnitIds: Array.isArray(units) ? units.filter((id): id is string => typeof id === 'string') : null,
    newCardOrder: input.newCardOrder === 'random' ? 'random' : defaults.newCardOrder,
    skipKnownWords: typeof input.skipKnownWords === 'boolean' ? input.skipKnownWords : defaults.skipKnownWords,
  };
}
