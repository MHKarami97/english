import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LexiDatabase } from '@/data/db/LexiDatabase';
import { DexieReviewLedger } from '@/data/review/DexieReviewLedger';
import {
  DexieDailyStatsRepository,
  DexieReviewCardRepository,
  DexieReviewLogRepository,
} from '@/data/review/ReviewRepositories';
import { makeCard, makeLog } from '../helpers/builders';
import { dropDb, openTestDb } from '../helpers/database';

let db: LexiDatabase;
let cards: DexieReviewCardRepository;
let logs: DexieReviewLogRepository;
let stats: DexieDailyStatsRepository;
let ledger: DexieReviewLedger;

beforeEach(async () => {
  db = await openTestDb();
  cards = new DexieReviewCardRepository(db);
  logs = new DexieReviewLogRepository(db);
  stats = new DexieDailyStatsRepository(db);
  ledger = new DexieReviewLedger(db, cards, logs, stats);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await dropDb(db);
});

describe('ReviewCardRepository', () => {
  it('returns due cards oldest first, per book, within the limit', async () => {
    await db.reviewCards.bulkPut([
      makeCard({ wordId: 'b:1:1', dueAt: 300 }),
      makeCard({ wordId: 'b:1:2', dueAt: 100 }),
      makeCard({ wordId: 'b:1:3', dueAt: 200 }),
      makeCard({ wordId: 'b:1:4', dueAt: 900 }),
      makeCard({ wordId: 'x:1:1', bookId: 'x', dueAt: 50 }),
    ]);
    expect((await cards.listDue('b', 500, 10)).map((card) => card.wordId)).toEqual(['b:1:2', 'b:1:3', 'b:1:1']);
    expect((await cards.listDue('b', 500, 2)).map((card) => card.wordId)).toEqual(['b:1:2', 'b:1:3']);
    expect(await cards.countDue('b', 500)).toBe(3);
    expect(await cards.countDue('b', 100)).toBe(0);
  });

  it('removes the cards of one unit only', async () => {
    await db.reviewCards.bulkPut([
      makeCard({ wordId: 'b:1:1', unitId: 'b:1' }),
      makeCard({ wordId: 'b:2:1', unitId: 'b:2' }),
    ]);
    expect(await cards.removeByUnit('b:1')).toBe(1);
    expect(await cards.listWordIds('b')).toEqual(['b:2:1']);
  });
});

describe('DexieReviewLedger', () => {
  it('writes the card, the log and the daily counters together', async () => {
    const logId = await ledger.record({
      card: makeCard({ wordId: 'b:1:1' }),
      log: makeLog({ previousState: 'new', rating: 'again', durationMs: 3_000 }),
      dateKey: '2026-03-01',
    });
    expect(logId).toBeGreaterThan(0);
    expect(await cards.get('b:1:1')).toBeDefined();
    expect(await db.reviewLogs.count()).toBe(1);
    expect(await stats.get('2026-03-01')).toEqual({
      dateKey: '2026-03-01',
      newCount: 1,
      reviewCount: 0,
      againCount: 1,
      totalDurationMs: 3_000,
    });
  });

  it('reverts an answer on an existing card to its previous schedule', async () => {
    const before = makeCard({ intervalDays: 6, dueAt: 1_000 });
    await cards.put(before);
    const logId = await ledger.record({
      card: makeCard({ intervalDays: 15, dueAt: 5_000 }),
      log: makeLog(),
      dateKey: '2026-03-01',
    });
    await ledger.revert({ logId, log: makeLog(), previousCard: before, dateKey: '2026-03-01' });
    expect(await cards.get('b:1:1')).toEqual(before);
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await stats.get('2026-03-01')).toMatchObject({ reviewCount: 0, newCount: 0, totalDurationMs: 0 });
  });

  it('deletes the card again when the reverted answer had introduced it', async () => {
    const log = makeLog({ previousState: 'new' });
    const logId = await ledger.record({ card: makeCard(), log, dateKey: '2026-03-01' });
    await ledger.revert({ logId, log, previousCard: null, dateKey: '2026-03-01' });
    expect(await cards.get('b:1:1')).toBeUndefined();
    expect((await stats.get('2026-03-01'))?.newCount).toBe(0);
  });

  it('rolls back every write when one of them fails', async () => {
    vi.spyOn(db.dailyStats, 'put').mockRejectedValueOnce(new Error('disk full'));
    await expect(
      ledger.record({ card: makeCard(), log: makeLog(), dateKey: '2026-03-01' }),
    ).rejects.toThrow('disk full');
    expect(await cards.get('b:1:1')).toBeUndefined();
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await db.dailyStats.count()).toBe(0);
  });
});
