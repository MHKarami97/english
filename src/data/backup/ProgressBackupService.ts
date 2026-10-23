import type { UserWordState } from '@/domain/entities';
import type { LexiDatabase, StoredWordState } from '../db/LexiDatabase';
import { BACKUP_FORMAT, BACKUP_VERSION, type ProgressBackup } from './backupSchema';

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  readonly reviewCards: number;
  readonly reviewLogs: number;
  readonly dailyStats: number;
  readonly wordStates: number;
  readonly settings: number;
}

const toDomain = (row: StoredWordState): UserWordState => ({
  wordId: row.wordId,
  bookId: row.bookId,
  isFavorite: row.favorite === 1,
  knowledge: row.knowledge,
  updatedAt: row.updatedAt,
});

const toStored = (state: UserWordState): StoredWordState => ({
  wordId: state.wordId,
  bookId: state.bookId,
  favorite: state.isFavorite ? 1 : 0,
  knowledge: state.knowledge,
  updatedAt: state.updatedAt,
});

const logKey = (wordId: string, reviewedAt: number): string => `${wordId}|${reviewedAt}`;

/** Exports and imports user data only; book content is never part of a backup. */
export class ProgressBackupService {
  constructor(
    private readonly db: LexiDatabase,
    private readonly appVersion: string,
  ) {}

  async export(now: number): Promise<ProgressBackup> {
    const [reviewCards, reviewLogs, dailyStats, wordStates, settings] = await Promise.all([
      this.db.reviewCards.toArray(),
      this.db.reviewLogs.toArray(),
      this.db.dailyStats.toArray(),
      this.db.userWordState.toArray(),
      this.db.settings.toArray(),
    ]);
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now,
      appVersion: this.appVersion,
      data: { reviewCards, reviewLogs, dailyStats, userWordStates: wordStates.map(toDomain), settings },
    };
  }

  /**
   * merge: the newer record wins per word (by last review / update time), logs are de-duplicated,
   * daily counters take the larger value, and existing settings are kept.
   * replace: all user data is cleared first, then the file is written.
   */
  async import(backup: ProgressBackup, mode: ImportMode): Promise<ImportSummary> {
    const db = this.db;
    const { data } = backup;
    return db.transaction('rw', [db.reviewCards, db.reviewLogs, db.dailyStats, db.userWordState, db.settings], async () => {
      if (mode === 'replace') {
        await db.reviewCards.clear();
        await db.reviewLogs.clear();
        await db.dailyStats.clear();
        await db.userWordState.clear();
        await db.settings.clear();
      }

      const existingCards = await db.reviewCards.bulkGet(data.reviewCards.map((card) => card.wordId));
      const cards = data.reviewCards.filter((card, index) => {
        const current = existingCards[index];
        return !current || (card.lastReviewedAt ?? 0) > (current.lastReviewedAt ?? 0);
      });
      await db.reviewCards.bulkPut(cards);

      const knownLogs = new Set((await db.reviewLogs.toArray()).map((log) => logKey(log.wordId, log.reviewedAt)));
      const logs = data.reviewLogs
        .filter((log) => !knownLogs.has(logKey(log.wordId, log.reviewedAt)))
        .map(({ id: _id, ...log }) => log);
      await db.reviewLogs.bulkAdd(logs);

      const existingStats = await db.dailyStats.bulkGet(data.dailyStats.map((stats) => stats.dateKey));
      const stats = data.dailyStats.map((incoming, index) => {
        const current = existingStats[index];
        if (!current) return incoming;
        return {
          dateKey: incoming.dateKey,
          newCount: Math.max(incoming.newCount, current.newCount),
          reviewCount: Math.max(incoming.reviewCount, current.reviewCount),
          againCount: Math.max(incoming.againCount, current.againCount),
          totalDurationMs: Math.max(incoming.totalDurationMs, current.totalDurationMs),
        };
      });
      await db.dailyStats.bulkPut(stats);

      const existingStates = await db.userWordState.bulkGet(data.userWordStates.map((state) => state.wordId));
      const states = data.userWordStates
        .filter((state, index) => {
          const current = existingStates[index];
          return !current || state.updatedAt > current.updatedAt;
        })
        .map(toStored);
      await db.userWordState.bulkPut(states);

      const existingSettings = await db.settings.bulkGet(data.settings.map((setting) => setting.key));
      const settings = data.settings.filter((_, index) => mode === 'replace' || !existingSettings[index]);
      await db.settings.bulkPut(settings.map((setting) => ({ key: setting.key, value: setting.value })));

      return {
        reviewCards: cards.length,
        reviewLogs: logs.length,
        dailyStats: stats.length,
        wordStates: states.length,
        settings: settings.length,
      };
    });
  }
}
