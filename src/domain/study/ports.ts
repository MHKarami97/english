import type { ReviewCard } from '../scheduling/types';
import type { DailyStats, ReviewLog } from './models';

export interface ReviewCardRepository {
  get(wordId: string): Promise<ReviewCard | undefined>;
  getMany(wordIds: readonly string[]): Promise<ReadonlyMap<string, ReviewCard>>;
  put(card: ReviewCard): Promise<void>;
  remove(wordId: string): Promise<void>;
  /** Cards whose dueAt is strictly before `dueBefore`, oldest first. */
  listDue(bookId: string, dueBefore: number, limit: number): Promise<readonly ReviewCard[]>;
  countDue(bookId: string, dueBefore: number): Promise<number>;
  listWordIds(bookId: string): Promise<readonly string[]>;
  removeByUnit(unitId: string): Promise<number>;
  clear(): Promise<void>;
}

export interface ReviewLogRepository {
  add(log: ReviewLog): Promise<number>;
  remove(id: number): Promise<void>;
  recent(limit: number): Promise<readonly ReviewLog[]>;
  clear(): Promise<void>;
}

export interface DailyStatsRepository {
  get(dateKey: string): Promise<DailyStats | undefined>;
  put(stats: DailyStats): Promise<void>;
  range(fromKey: string, toKey: string): Promise<readonly DailyStats[]>;
  listAll(): Promise<readonly DailyStats[]>;
  clear(): Promise<void>;
}

export interface LedgerEntry {
  readonly card: ReviewCard;
  readonly log: ReviewLog;
  readonly dateKey: string;
}

export interface RevertEntry {
  readonly logId: number;
  readonly log: ReviewLog;
  /** null when the answer introduced the card, so reverting deletes it again. */
  readonly previousCard: ReviewCard | null;
  readonly dateKey: string;
}

/** Unit of work: one answer (or its undo) touches card, log and daily stats atomically. */
export interface ReviewLedger {
  record(entry: LedgerEntry): Promise<number>;
  revert(entry: RevertEntry): Promise<void>;
}
