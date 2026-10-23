export type Outcome = 'correct' | 'almost' | 'close-form' | 'wrong';

export interface Grade {
  readonly outcome: Outcome;
  readonly correct: boolean;
  /** True for "almost" and "close, check the form"; both count as correct. */
  readonly almost: boolean;
  readonly expected: string;
}

export interface GradeOptions {
  readonly typoTolerance: boolean;
}

export const gradeOutcome = (outcome: Outcome, expected: string): Grade => ({
  outcome,
  correct: outcome !== 'wrong',
  almost: outcome === 'almost' || outcome === 'close-form',
  expected,
});

export interface AnswerNormalizer {
  normalize(text: string): string;
}

const APOSTROPHES = /[\u2018\u2019\u201B\u02BC\u2032`\u00B4]/g;
const HYPHENS = /[\u2010-\u2015\u2212]/g;

export class DefaultAnswerNormalizer implements AnswerNormalizer {
  normalize(text: string): string {
    return text
      .normalize('NFKC')
      .replace(APOSTROPHES, "'")
      .replace(HYPHENS, '-')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

export interface TypedTarget {
  readonly answer: string;
  /** Accepted, but reported as "close, check the form". */
  readonly alternative?: string;
}

const MIN_LENGTH_FOR_TYPO = 5;

export function gradeTyped(
  input: string,
  target: TypedTarget,
  options: GradeOptions,
  normalizer: AnswerNormalizer,
): Grade {
  const typed = normalizer.normalize(input);
  const expected = normalizer.normalize(target.answer);
  if (typed.length === 0) return gradeOutcome('wrong', target.answer);
  if (typed === expected) return gradeOutcome('correct', target.answer);
  if (target.alternative && typed === normalizer.normalize(target.alternative)) {
    return gradeOutcome('close-form', target.answer);
  }
  if (options.typoTolerance && expected.length >= MIN_LENGTH_FOR_TYPO && levenshtein(typed, expected) === 1) {
    return gradeOutcome('almost', target.answer);
  }
  return gradeOutcome('wrong', target.answer);
}
