import Dexie, { type EntityTable } from 'dexie';
import type { Book, Knowledge, Unit, Word } from '@/domain/entities';

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

  constructor(name = 'lexi-book-db') {
    super(name);
    // Content tables (books, units, words, importState) and user tables (userWordState, settings)
    // are disjoint so a content re-import can never touch progress.
    this.version(1).stores({
      books: 'id',
      units: 'id, bookId',
      words: 'id, bookId, unitId',
      userWordState: 'wordId, bookId, [bookId+knowledge], [bookId+favorite]',
      settings: 'key',
      importState: 'bookId',
    });
  }
}
