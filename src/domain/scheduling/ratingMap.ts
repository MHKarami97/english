import type { Rating } from './types';

/**
 * The only place that maps the four buttons to SM-2 quality grades (0-5).
 * Hard = 3 ("correct, serious difficulty"), Good = 4 ("correct after a hesitation"),
 * Easy = 5 ("perfect"), Again = 1 ("incorrect, but the answer felt familiar").
 */
export const RATING_QUALITY: Readonly<Record<Rating, number>> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};
