import Dexie, { type EntityTable } from 'dexie';
import type { Book, Knowledge, Unit, Word } from '@/domain/entities';
import type { ReviewCard } from '@/domain/scheduling/types';
import type { DailyStats, ReviewLog } from '@/domain/study/models';

/** IndexedDB cannot index booleans, so favorites are stored as 0 | 1. */
export interface StoredWordState {
  readonly wordId: string;
  readonly bookId: string;
  readonly favorite: 0 | 1;
  readonly knowledge: Knowledge;
  readonly updatedAt: number;
}

export interface StoredSetting {
  readonly key: string;
  readonly value: unknown;
}

export interface ImportState {
  readonly bookId: string;
  readonly contentHash: string;
  readonly status: 'importing' | 'done';
  readonly updatedAt: number;
}

export class LexiDatabase extends Dexie {
  declare readonly books: EntityTable<Book, 'id'>;
  declare readonly units: EntityTable<Unit, 'id'>;
  declare readonly words: EntityTable<Word, 'id'>;
  declare readonly userWordState: EntityTable<StoredWordState, 'wordId'>;
  declare readonly settings: EntityTable<StoredSetting, 'key'>;
  declare readonly importState: EntityTable<ImportState, 'bookId'>;
  declare readonly reviewCards: EntityTable<ReviewCard, 'wordId'>;
  declare readonly reviewLogs: EntityTable<ReviewLog, 'id'>;
  declare readonly dailyStats: EntityTable<DailyStats, 'dateKey'>;

  constructor(name = 'lexi-book-db') {
    super(name);
    // Content tables (books, units, words, importState) and user tables (userWordState, settings,
    // reviewCards, reviewLogs, dailyStats) are disjoint so a content re-import never touches progress.
    this.version(1).stores({
      books: 'id',
      units: 'id, bookId',
      words: 'id, bookId, unitId',
      userWordState: 'wordId, bookId, [bookId+knowledge], [bookId+favorite]',
      settings: 'key',
      importState: 'bookId',
    });
    // Version 2 only adds tables, so no upgrade function is needed and v1 rows are left untouched.
    this.version(2).stores({
      reviewCards: 'wordId, bookId, unitId, [bookId+dueAt], [bookId+state]',
      reviewLogs: '++id, wordId, reviewedAt, [bookId+reviewedAt]',
      dailyStats: 'dateKey',
    });
  }
}
