import { applyLog } from '@/domain/study/dailyStats';
import { emptyDailyStats } from '@/domain/study/models';
import type {
  DailyStatsRepository,
  LedgerEntry,
  ReviewCardRepository,
  ReviewLedger,
  ReviewLogRepository,
  RevertEntry,
} from '@/domain/study/ports';
import type { LexiDatabase } from '../db/LexiDatabase';

/**
 * Dexie propagates the ambient transaction to every repository call made inside the callback,
 * so a failure in any of the three writes rolls all of them back.
 */
export class DexieReviewLedger implements ReviewLedger {
  constructor(
    private readonly db: LexiDatabase,
    private readonly cards: ReviewCardRepository,
    private readonly logs: ReviewLogRepository,
    private readonly stats: DailyStatsRepository,
  ) {}

  record(entry: LedgerEntry): Promise<number> {
    return this.db.transaction('rw', this.db.reviewCards, this.db.reviewLogs, this.db.dailyStats, async () => {
      await this.cards.put(entry.card);
      const logId = await this.logs.add(entry.log);
      const stats = (await this.stats.get(entry.dateKey)) ?? emptyDailyStats(entry.dateKey);
      await this.stats.put(applyLog(stats, entry.log, 1));
      return logId;
    });
  }

  revert(entry: RevertEntry): Promise<void> {
    return this.db.transaction('rw', this.db.reviewCards, this.db.reviewLogs, this.db.dailyStats, async () => {
      if (entry.previousCard) await this.cards.put(entry.previousCard);
      else await this.cards.remove(entry.log.wordId);
      await this.logs.remove(entry.logId);
      const stats = (await this.stats.get(entry.dateKey)) ?? emptyDailyStats(entry.dateKey);
      await this.stats.put(applyLog(stats, entry.log, -1));
    });
  }
}
