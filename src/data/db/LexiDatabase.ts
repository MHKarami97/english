import Dexie, { type EntityTable } from 'dexie';
import type { Book, Knowledge, Unit, Word } from '@/domain/entities';
import type { DownloadRecord } from '@/domain/download/models';
import { splitPos } from '@/domain/parsing/pronunciation';
import type { Mistake, PlacementResult, QuizAnswerLog, QuizSession } from '@/domain/quiz/models';
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
  declare readonly quizSessions: EntityTable<QuizSession, 'id'>;
  declare readonly quizAnswerLogs: EntityTable<QuizAnswerLog, 'id'>;
  declare readonly mistakes: EntityTable<Mistake, 'wordId'>;
  declare readonly placementResults: EntityTable<PlacementResult, 'id'>;
  declare readonly downloadRecords: EntityTable<DownloadRecord, 'unitId'>;

  constructor(name = 'lexi-book-db') {
    super(name);
    // Content tables (books, units, words, importState) and user tables are disjoint so a content
    // re-import never touches progress.
    this.version(1).stores({
      books: 'id',
      units: 'id, bookId',
      words: 'id, bookId, unitId',
      userWordState: 'wordId, bookId, [bookId+knowledge], [bookId+favorite]',
      settings: 'key',
      importState: 'bookId',
    });
    this.version(2).stores({
      reviewCards: 'wordId, bookId, unitId, [bookId+dueAt], [bookId+state]',
      reviewLogs: '++id, wordId, reviewedAt, [bookId+reviewedAt]',
      dailyStats: 'dateKey',
    });
    // Version 3 adds the quiz tables and a multi-entry index on words.posTags. Existing words get
    // their posTags computed from `pos` here, because an unchanged content hash never re-imports them.
    this.version(3)
      .stores({
        words: 'id, bookId, unitId, *posTags',
        quizSessions: 'id, startedAt, mode',
        quizAnswerLogs: '++id, sessionId, wordId, answeredAt',
        mistakes: 'wordId, lastWrongAt',
        placementResults: 'id, bookId, takenAt',
      })
      .upgrade((transaction) =>
        transaction
          .table('words')
          .toCollection()
          .modify((word: { pos?: string; posTags?: string[] }) => {
            word.posTags = splitPos(word.pos ?? '').map((tag) => tag.toLowerCase());
          }),
      );
    // Version 4 only adds a table, so no upgrade function is needed and every existing row stays as it is.
    // Unit ids are globally unique ("<bookId>:<n>"), so the unit id alone is the primary key.
    this.version(4).stores({
      downloadRecords: 'unitId, bookId, status',
    });
  }
}
