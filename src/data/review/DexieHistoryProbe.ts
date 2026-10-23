import type { LexiDatabase } from '../db/LexiDatabase';

export class DexieHistoryProbe {
  constructor(private readonly db: LexiDatabase) {}

  /** Time of the oldest review, or null when the user has never reviewed anything. */
  async firstReviewAt(): Promise<number | null> {
    const first = await this.db.reviewLogs.orderBy('reviewedAt').first();
    return first?.reviewedAt ?? null;
  }
}
