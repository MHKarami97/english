import type { Word } from '../entities';

export interface ClozeParts {
  readonly before: string;
  readonly after: string;
  readonly answer: string;
  readonly headword: string;
  /** The sentence uses a different form (for example a plural) than the headword. */
  readonly inflected: boolean;
}

/** Uses the first non-empty highlight as the blank; returns null when the example has none. */
export function buildCloze(word: Word): ClozeParts | null {
  const segments = word.exampleSegments;
  const index = segments.findIndex((segment) => segment.highlight && segment.text.trim().length > 0);
  const highlighted = segments[index];
  if (index === -1 || !highlighted) return null;

  const answer = highlighted.text.trim();
  const lead = highlighted.text.slice(0, highlighted.text.indexOf(answer));
  const trail = highlighted.text.slice(lead.length + answer.length);
  const join = (items: readonly { text: string }[]): string => items.map((item) => item.text).join('');
  const headword = word.word.trim();

  return {
    before: join(segments.slice(0, index)) + lead,
    after: trail + join(segments.slice(index + 1)),
    answer,
    headword,
    inflected: answer.toLowerCase() !== headword.toLowerCase(),
  };
}
