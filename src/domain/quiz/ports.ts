import type { Knowledge, UserWordState } from '../entities';
import type { Mistake, PlacementResult, QuizAnswerLog, QuizSession } from './models';

export interface QuizSessionRepository {
  put(session: QuizSession): Promise<void>;
  get(id: string): Promise<QuizSession | undefined>;
  recent(limit: number): Promise<readonly QuizSession[]>;
  clear(): Promise<void>;
}

export interface QuizAnswerLogRepository {
  add(log: QuizAnswerLog): Promise<number>;
  clear(): Promise<void>;
}

export interface MistakeRepository {
  get(wordId: string): Promise<Mistake | undefined>;
  put(mistake: Mistake): Promise<void>;
  remove(wordId: string): Promise<void>;
  list(limit: number): Promise<readonly Mistake[]>;
  count(): Promise<number>;
  wordIds(limit: number): Promise<readonly string[]>;
  clear(): Promise<void>;
}

export interface PlacementRepository {
  put(result: PlacementResult): Promise<void>;
  latest(bookId: string): Promise<PlacementResult | undefined>;
}

export interface QuizLedgerEntry {
  readonly log: QuizAnswerLog;
  readonly practicingMistakes: boolean;
}

/** Unit of work: the answer log and the mistake update are written in one transaction. */
export interface QuizLedger {
  recordAnswer(entry: QuizLedgerEntry): Promise<void>;
}

/** Id-only indexed queries, so a scope never loads full word objects. */
export interface WordQueries {
  idsByUnit(unitId: string): Promise<readonly string[]>;
  idsByBook(bookId: string): Promise<readonly string[]>;
  idsByKnowledge(bookId: string, knowledge: Knowledge): Promise<readonly string[]>;
}

export interface KnownSnapshot {
  readonly entries: readonly { readonly wordId: string; readonly previous: UserWordState | null }[];
}

export interface KnownMarker {
  countToMarkKnown(wordIds: readonly string[]): Promise<number>;
  markKnown(bookId: string, wordIds: readonly string[], at: number): Promise<KnownSnapshot>;
  restore(snapshot: KnownSnapshot): Promise<void>;
}
