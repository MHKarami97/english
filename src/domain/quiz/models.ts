import type { Confidence } from './placement';

export type QuizMode = 'mcq' | 'cloze' | 'dictation' | 'pictures' | 'mixed' | 'timed' | 'mistakes';
export type SessionMode = QuizMode | 'matching' | 'placement';

export type PracticeScope =
  | { readonly kind: 'units'; readonly unitIds: readonly string[] }
  | { readonly kind: 'book' }
  | { readonly kind: 'favorites' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'due' }
  | { readonly kind: 'mistakes' };

export interface QuizSession {
  readonly id: string;
  readonly mode: SessionMode;
  readonly scope: PracticeScope;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly totalQuestions: number;
  readonly correctCount: number;
  readonly durationMs: number;
  readonly seed: number;
}

/** Append-only; a future statistics dashboard reads it. */
export interface QuizAnswerLog {
  readonly id?: number;
  readonly sessionId: string;
  readonly wordId: string;
  readonly questionType: string;
  readonly correct: boolean;
  readonly almost: boolean;
  readonly answeredAt: number;
  readonly durationMs: number;
}

export interface Mistake {
  readonly wordId: string;
  readonly questionType: string;
  readonly wrongCount: number;
  readonly consecutiveCorrect: number;
  readonly lastWrongAt: number;
  readonly createdAt: number;
}

export interface PlacementResult {
  readonly id: string;
  readonly bookId: string;
  readonly takenAt: number;
  readonly estimatedStartUnitId: string | null;
  readonly perUnitAccuracy: Readonly<Record<string, number>>;
  readonly confidence: Confidence;
}

export interface QuizSettings {
  readonly quizQuestionCount: number;
  readonly quizOptionCount: number;
  readonly timedChallengeSeconds: number;
  readonly typoTolerance: boolean;
  readonly showHints: boolean;
  readonly quizAutoPlayAudio: boolean;
  readonly quizAutoAdvance: boolean;
}

export const QUIZ_SETTING_LIMITS = {
  quizQuestionCount: { min: 3, max: 100 },
  quizOptionCount: { min: 3, max: 6 },
  timedChallengeSeconds: { min: 15, max: 300 },
} as const;

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  quizQuestionCount: 10,
  quizOptionCount: 4,
  timedChallengeSeconds: 60,
  typoTolerance: true,
  showHints: true,
  quizAutoPlayAudio: true,
  quizAutoAdvance: true,
};

function clampInt(value: unknown, limits: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

export function sanitizeQuizSettings(input: Partial<Record<keyof QuizSettings, unknown>>): QuizSettings {
  const defaults = DEFAULT_QUIZ_SETTINGS;
  return {
    quizQuestionCount: clampInt(input.quizQuestionCount, QUIZ_SETTING_LIMITS.quizQuestionCount, defaults.quizQuestionCount),
    quizOptionCount: clampInt(input.quizOptionCount, QUIZ_SETTING_LIMITS.quizOptionCount, defaults.quizOptionCount),
    timedChallengeSeconds: clampInt(input.timedChallengeSeconds, QUIZ_SETTING_LIMITS.timedChallengeSeconds, defaults.timedChallengeSeconds),
    typoTolerance: flag(input.typoTolerance, defaults.typoTolerance),
    showHints: flag(input.showHints, defaults.showHints),
    quizAutoPlayAudio: flag(input.quizAutoPlayAudio, defaults.quizAutoPlayAudio),
    quizAutoAdvance: flag(input.quizAutoAdvance, defaults.quizAutoAdvance),
  };
}
