import Dexie from 'dexie';
import type { ReviewCard } from '@/domain/scheduling/types';
import type { DailyStats, ReviewLog } from '@/domain/study/models';
import type {
  DailyStatsRepository,
  ReviewCardRepository,
  ReviewLogRepository,
} from '@/domain/study/ports';
import type { LexiDatabase } from '../db/LexiDatabase';

export class DexieReviewCardRepository implements ReviewCardRepository {
  constructor(private readonly db: LexiDatabase) {}

  get(wordId: string): Promise<ReviewCard | undefined> {
    return this.db.reviewCards.get(wordId);
  }

  async getMany(wordIds: readonly string[]): Promise<ReadonlyMap<string, ReviewCard>> {
    const rows = await this.db.reviewCards.bulkGet([...wordIds]);
    const cards = new Map<string, ReviewCard>();
    for (const row of rows) if (row) cards.set(row.wordId, row);
    return cards;
  }

  async put(card: ReviewCard): Promise<void> {
    await this.db.reviewCards.put(card);
  }

  remove(wordId: string): Promise<void> {
    return this.db.reviewCards.delete(wordId);
  }

  listDue(bookId: string, dueBefore: number, limit: number): Promise<readonly ReviewCard[]> {
    return this.dueRange(bookId, dueBefore).limit(limit).toArray();
  }

  countDue(bookId: string, dueBefore: number): Promise<number> {
    return this.dueRange(bookId, dueBefore).count();
  }

  listWordIds(bookId: string): Promise<readonly string[]> {
    return this.db.reviewCards.where('bookId').equals(bookId).primaryKeys();
  }

  removeByUnit(unitId: string): Promise<number> {
    return this.db.reviewCards.where('unitId').equals(unitId).delete();
  }

  clear(): Promise<void> {
    return this.db.reviewCards.clear();
  }

  // The compound index keeps this a range scan ordered by dueAt, not a filter over every card.
  private dueRange(bookId: string, dueBefore: number) {
    return this.db.reviewCards
      .where('[bookId+dueAt]')
      .between([bookId, Dexie.minKey], [bookId, dueBefore], true, false);
  }
}

export class DexieReviewLogRepository implements ReviewLogRepository {
  constructor(private readonly db: LexiDatabase) {}

  async add(log: ReviewLog): Promise<number> {
    const id = await this.db.reviewLogs.add(log);
    if (id === undefined) throw new Error('Review log was stored without an id');
    return id;
  }

  remove(id: number): Promise<void> {
    return this.db.reviewLogs.delete(id);
  }

  recent(limit: number): Promise<readonly ReviewLog[]> {
    return this.db.reviewLogs.orderBy('reviewedAt').reverse().limit(limit).toArray();
  }

  clear(): Promise<void> {
    return this.db.reviewLogs.clear();
  }
}

export class DexieDailyStatsRepository implements DailyStatsRepository {
  constructor(private readonly db: LexiDatabase) {}

  get(dateKey: string): Promise<DailyStats | undefined> {
    return this.db.dailyStats.get(dateKey);
  }

  async put(stats: DailyStats): Promise<void> {
    await this.db.dailyStats.put(stats);
  }

  range(fromKey: string, toKey: string): Promise<readonly DailyStats[]> {
    return this.db.dailyStats.where('dateKey').between(fromKey, toKey, true, true).toArray();
  }

  listAll(): Promise<readonly DailyStats[]> {
    return this.db.dailyStats.toArray();
  }

  clear(): Promise<void> {
    return this.db.dailyStats.clear();
  }
}
