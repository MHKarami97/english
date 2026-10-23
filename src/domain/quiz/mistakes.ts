import type { Mistake } from './models';

export const CONSECUTIVE_CORRECT_TO_CLEAR = 2;

export interface MistakeAnswer {
  readonly wordId: string;
  readonly questionType: string;
  readonly correct: boolean;
  readonly at: number;
  /** True only while practicing the mistakes queue; correct answers elsewhere never clear a mistake. */
  readonly practicing: boolean;
}

/**
 * wrong:   create, or wrongCount + 1 and the correct streak resets
 * correct: while practicing, streak + 1; at two in a row the mistake is removed (returns null)
 */
export function applyMistakeAnswer(current: Mistake | null, answer: MistakeAnswer): Mistake | null {
  if (!answer.correct) {
    return {
      wordId: answer.wordId,
      questionType: answer.questionType,
      wrongCount: (current?.wrongCount ?? 0) + 1,
      consecutiveCorrect: 0,
      lastWrongAt: answer.at,
      createdAt: current?.createdAt ?? answer.at,
    };
  }
  if (!current || !answer.practicing) return current;
  const streak = current.consecutiveCorrect + 1;
  return streak >= CONSECUTIVE_CORRECT_TO_CLEAR ? null : { ...current, consecutiveCorrect: streak };
}
