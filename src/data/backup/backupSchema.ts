import type { Setting, UserWordState } from '@/domain/entities';
import type { ReviewCard } from '@/domain/scheduling/types';
import type { DailyStats, ReviewLog } from '@/domain/study/models';

export const BACKUP_FORMAT = 'lexi-book-progress';
export const BACKUP_VERSION = 1;

export interface ProgressBackup {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly exportedAt: number;
  readonly appVersion: string;
  readonly data: {
    readonly reviewCards: readonly ReviewCard[];
    readonly reviewLogs: readonly ReviewLog[];
    readonly dailyStats: readonly DailyStats[];
    readonly userWordStates: readonly UserWordState[];
    readonly settings: readonly Setting[];
  };
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

type Guard<T> = (value: unknown) => value is T;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isOneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);

const STATES = ['new', 'learning', 'review', 'relearning'] as const;
const RATING_VALUES = ['again', 'hard', 'good', 'easy'] as const;
const KNOWLEDGE = ['unknown', 'known', 'new'] as const;

const isReviewCard: Guard<ReviewCard> = (value): value is ReviewCard =>
  isRecord(value) &&
  isString(value.wordId) &&
  isString(value.bookId) &&
  isString(value.unitId) &&
  isOneOf(value.state, STATES) &&
  isNumber(value.ease) &&
  value.ease >= 1.3 &&
  value.ease <= 10 &&
  isNumber(value.intervalDays) &&
  value.intervalDays >= 0 &&
  isNumber(value.repetitions) &&
  isNumber(value.lapses) &&
  isNumber(value.dueAt) &&
  (value.lastReviewedAt === null || isNumber(value.lastReviewedAt)) &&
  isNumber(value.createdAt);

const isReviewLog: Guard<ReviewLog> = (value): value is ReviewLog =>
  isRecord(value) &&
  isString(value.wordId) &&
  isString(value.bookId) &&
  isOneOf(value.rating, RATING_VALUES) &&
  isOneOf(value.previousState, STATES) &&
  isNumber(value.previousInterval) &&
  isNumber(value.newInterval) &&
  isNumber(value.easeBefore) &&
  isNumber(value.easeAfter) &&
  isNumber(value.reviewedAt) &&
  isNumber(value.durationMs);

const isDailyStats: Guard<DailyStats> = (value): value is DailyStats =>
  isRecord(value) &&
  isString(value.dateKey) &&
  /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) &&
  isNumber(value.newCount) &&
  isNumber(value.reviewCount) &&
  isNumber(value.againCount) &&
  isNumber(value.totalDurationMs);

const isUserWordState: Guard<UserWordState> = (value): value is UserWordState =>
  isRecord(value) &&
  isString(value.wordId) &&
  isString(value.bookId) &&
  typeof value.isFavorite === 'boolean' &&
  isOneOf(value.knowledge, KNOWLEDGE) &&
  isNumber(value.updatedAt);

const isSetting: Guard<Setting> = (value): value is Setting =>
  isRecord(value) && isString(value.key) && 'value' in value;

function readList<T>(value: unknown, guard: Guard<T>, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new BackupError(`The file has no list of ${label}.`);
  const invalid = value.findIndex((item) => !guard(item));
  if (invalid !== -1) throw new BackupError(`Entry ${invalid + 1} in ${label} is not valid.`);
  return value as readonly T[];
}

/** Rejects the whole file on the first problem, so a damaged backup can never be half-applied. */
export function parseBackup(text: string): ProgressBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('The file is not valid JSON.');
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    throw new BackupError('This is not a Lexi Book progress file.');
  }
  if (!isNumber(raw.version) || raw.version < 1 || raw.version > BACKUP_VERSION) {
    throw new BackupError('This file was made by a different version of the app and cannot be read.');
  }
  const data = raw.data;
  if (!isRecord(data)) throw new BackupError('The file has no data section.');

  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: isNumber(raw.exportedAt) ? raw.exportedAt : 0,
    appVersion: isString(raw.appVersion) ? raw.appVersion : 'unknown',
    data: {
      reviewCards: readList(data.reviewCards, isReviewCard, 'review cards'),
      reviewLogs: readList(data.reviewLogs, isReviewLog, 'review logs'),
      dailyStats: readList(data.dailyStats, isDailyStats, 'daily statistics'),
      userWordStates: readList(data.userWordStates, isUserWordState, 'word states'),
      settings: readList(data.settings, isSetting, 'settings'),
    },
  };
}
