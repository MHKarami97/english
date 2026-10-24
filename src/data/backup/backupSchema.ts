import type { Setting, UserWordState } from '@/domain/entities';
import type { Mistake, PlacementResult, QuizAnswerLog, QuizSession } from '@/domain/quiz/models';
import type { ReviewCard } from '@/domain/scheduling/types';
import type { DailyStats, ReviewLog } from '@/domain/study/models';

export const BACKUP_FORMAT = 'lexi-book-progress';
/** 1: Phase 2 (study data). 2: Phase 3 adds quiz sessions, answer logs, mistakes and placement results. */
export const BACKUP_VERSION = 2;

export type BackupErrorCode =
  | 'invalidJson'
  | 'notProgressFile'
  | 'unsupportedVersion'
  | 'noData'
  | 'missingList'
  | 'invalidEntry';

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
    readonly quizSessions: readonly QuizSession[];
    readonly quizAnswerLogs: readonly QuizAnswerLog[];
    readonly mistakes: readonly Mistake[];
    readonly placementResults: readonly PlacementResult[];
  };
}

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  readonly values: Record<string, string | number>;

  constructor(code: BackupErrorCode, values: Record<string, string | number> = {}) {
    super(code);
    this.name = 'BackupError';
    this.code = code;
    this.values = values;
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
const CONFIDENCE = ['low', 'medium', 'high'] as const;

const isReviewCard: Guard<ReviewCard> = (value): value is ReviewCard =>
  isRecord(value) && isString(value.wordId) && isString(value.bookId) && isString(value.unitId) && isOneOf(value.state, STATES) && isNumber(value.ease) && value.ease >= 1.3 && value.ease <= 10 && isNumber(value.intervalDays) && value.intervalDays >= 0 && isNumber(value.repetitions) && isNumber(value.lapses) && isNumber(value.dueAt) && (value.lastReviewedAt === null || isNumber(value.lastReviewedAt)) && isNumber(value.createdAt);

const isReviewLog: Guard<ReviewLog> = (value): value is ReviewLog =>
  isRecord(value) && isString(value.wordId) && isString(value.bookId) && isOneOf(value.rating, RATING_VALUES) && isOneOf(value.previousState, STATES) && isNumber(value.previousInterval) && isNumber(value.newInterval) && isNumber(value.easeBefore) && isNumber(value.easeAfter) && isNumber(value.reviewedAt) && isNumber(value.durationMs);

const isDailyStats: Guard<DailyStats> = (value): value is DailyStats =>
  isRecord(value) && isString(value.dateKey) && /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) && isNumber(value.newCount) && isNumber(value.reviewCount) && isNumber(value.againCount) && isNumber(value.totalDurationMs);

const isUserWordState: Guard<UserWordState> = (value): value is UserWordState =>
  isRecord(value) && isString(value.wordId) && isString(value.bookId) && typeof value.isFavorite === 'boolean' && isOneOf(value.knowledge, KNOWLEDGE) && isNumber(value.updatedAt);

const isSetting: Guard<Setting> = (value): value is Setting => isRecord(value) && isString(value.key) && 'value' in value;

const isQuizSession: Guard<QuizSession> = (value): value is QuizSession =>
  isRecord(value) && isString(value.id) && isString(value.mode) && isRecord(value.scope) && isString(value.scope.kind) && isNumber(value.startedAt) && (value.finishedAt === null || isNumber(value.finishedAt)) && isNumber(value.totalQuestions) && isNumber(value.correctCount) && isNumber(value.durationMs) && isNumber(value.seed);

const isQuizAnswerLog: Guard<QuizAnswerLog> = (value): value is QuizAnswerLog =>
  isRecord(value) && isString(value.sessionId) && isString(value.wordId) && isString(value.questionType) && typeof value.correct === 'boolean' && typeof value.almost === 'boolean' && isNumber(value.answeredAt) && isNumber(value.durationMs);

const isMistake: Guard<Mistake> = (value): value is Mistake =>
  isRecord(value) && isString(value.wordId) && isString(value.questionType) && isNumber(value.wrongCount) && isNumber(value.consecutiveCorrect) && isNumber(value.lastWrongAt) && isNumber(value.createdAt);

const isPlacementResult: Guard<PlacementResult> = (value): value is PlacementResult =>
  isRecord(value) && isString(value.id) && isString(value.bookId) && isNumber(value.takenAt) && (value.estimatedStartUnitId === null || isString(value.estimatedStartUnitId)) && isRecord(value.perUnitAccuracy) && isOneOf(value.confidence, CONFIDENCE);

function readList<T>(value: unknown, guard: Guard<T>, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new BackupError('missingList', { list: label });
  const invalid = value.findIndex((item) => !guard(item));
  if (invalid !== -1) throw new BackupError('invalidEntry', { list: label, index: invalid + 1 });
  return value as readonly T[];
}

function readOptionalList<T>(value: unknown, guard: Guard<T>, label: string): readonly T[] {
  return value === undefined ? [] : readList(value, guard, label);
}

export function parseBackup(text: string): ProgressBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('invalidJson');
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError('notProgressFile');
  if (!isNumber(raw.version) || raw.version < 1 || raw.version > BACKUP_VERSION) throw new BackupError('unsupportedVersion');
  const data = raw.data;
  if (!isRecord(data)) throw new BackupError('noData');

  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: isNumber(raw.exportedAt) ? raw.exportedAt : 0,
    appVersion: isString(raw.appVersion) ? raw.appVersion : 'unknown',
    data: {
      reviewCards: readList(data.reviewCards, isReviewCard, 'reviewCards'),
      reviewLogs: readList(data.reviewLogs, isReviewLog, 'reviewLogs'),
      dailyStats: readList(data.dailyStats, isDailyStats, 'dailyStats'),
      userWordStates: readList(data.userWordStates, isUserWordState, 'wordStates'),
      settings: readList(data.settings, isSetting, 'settings'),
      quizSessions: readOptionalList(data.quizSessions, isQuizSession, 'quizSessions'),
      quizAnswerLogs: readOptionalList(data.quizAnswerLogs, isQuizAnswerLog, 'quizAnswers'),
      mistakes: readOptionalList(data.mistakes, isMistake, 'mistakes'),
      placementResults: readOptionalList(data.placementResults, isPlacementResult, 'placementResults'),
    },
  };
}
