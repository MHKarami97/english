import type { Word } from '@/domain/entities';
import type { ReviewCard } from '@/domain/scheduling/types';
import type { ReviewLog } from '@/domain/study/models';

export const makeCard = (overrides: Partial<ReviewCard> = {}): ReviewCard => ({
  wordId: 'b:1:1',
  bookId: 'b',
  unitId: 'b:1',
  state: 'review',
  ease: 2.5,
  intervalDays: 6,
  repetitions: 2,
  lapses: 0,
  dueAt: 1_000,
  lastReviewedAt: 500,
  createdAt: 100,
  ...overrides,
});

export const makeLog = (overrides: Partial<ReviewLog> = {}): ReviewLog => ({
  wordId: 'b:1:1',
  bookId: 'b',
  rating: 'good',
  previousState: 'review',
  previousInterval: 6,
  newInterval: 15,
  easeBefore: 2.5,
  easeAfter: 2.5,
  reviewedAt: 1_000,
  durationMs: 4_000,
  ...overrides,
});

export const makeWord = (unitOrder: number, order: number, overrides: Partial<Word> = {}): Word => ({
  id: `b:${unitOrder}:${order}`,
  bookId: 'b',
  unitId: `b:${unitOrder}`,
  order,
  word: `word-${unitOrder}-${order}`,
  ipa: '',
  pos: 'n.',
  posTags: ['n.'],
  definition: '',
  exampleSegments: [],
  translationFa: '',
  image: '',
  sound: '',
  ...overrides,
});
