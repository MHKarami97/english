const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'is', 'are', 'was', 'were', 'be', 'in', 'on', 'at', 'and', 'or', 'it',
  'that', 'this', 'for', 'with', 'as', 'by', 'when', 'who', 'what', 'someone', 'something', 'they',
  'their', 'he', 'she', 'his', 'her', 'you', 'your', 'one',
]);

/** Two definitions sharing at least this share of their meaningful words count as nearly identical. */
export const SIMILARITY_THRESHOLD = 0.6;

export const meaningfulTokens = (text: string): ReadonlySet<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );

/** Jaccard overlap: shared tokens divided by all distinct tokens of both texts. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export const isNearlyIdentical = (first: string, second: string): boolean =>
  jaccard(meaningfulTokens(first), meaningfulTokens(second)) >= SIMILARITY_THRESHOLD;

export const containsEither = (first: string, second: string): boolean => {
  const a = first.toLowerCase();
  const b = second.toLowerCase();
  return a.includes(b) || b.includes(a);
};
