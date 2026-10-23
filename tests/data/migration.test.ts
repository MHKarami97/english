import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { LexiDatabase } from '@/data/db/LexiDatabase';

const name = 'migration-test-db';

afterEach(async () => {
  await Dexie.delete(name);
});

describe('Dexie upgrade to the current version', () => {
  it('keeps Phase 1 and Phase 2 data, adds empty quiz tables and fills posTags', async () => {
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      books: 'id',
      units: 'id, bookId',
      words: 'id, bookId, unitId',
      userWordState: 'wordId, bookId, [bookId+knowledge], [bookId+favorite]',
      settings: 'key',
      importState: 'bookId',
    });
    legacy.version(2).stores({
      reviewCards: 'wordId, bookId, unitId, [bookId+dueAt], [bookId+state]',
      reviewLogs: '++id, wordId, reviewedAt, [bookId+reviewedAt]',
      dailyStats: 'dateKey',
    });
    await legacy.table('userWordState').bulkPut([
      { wordId: 'b:1:1', bookId: 'b', favorite: 1, knowledge: 'known', updatedAt: 10 },
      { wordId: 'b:1:2', bookId: 'b', favorite: 0, knowledge: 'unknown', updatedAt: 20 },
    ]);
    await legacy.table('settings').put({ key: 'autoPlayOnFlip', value: true });
    await legacy.table('words').put({ id: 'b:1:1', bookId: 'b', unitId: 'b:1', pos: 'n. v.' });
    await legacy.table('reviewCards').put({ wordId: 'b:1:1', bookId: 'b', unitId: 'b:1', dueAt: 5 });
    legacy.close();

    const db = new LexiDatabase(name);
    await db.open();

    expect(db.verno).toBe(3);
    expect(await db.userWordState.count()).toBe(2);
    expect((await db.userWordState.get('b:1:1'))?.favorite).toBe(1);
    expect((await db.settings.get('autoPlayOnFlip'))?.value).toBe(true);
    expect((await db.reviewCards.get('b:1:1'))?.dueAt).toBe(5);
    expect((await db.words.get('b:1:1'))?.posTags).toEqual(['n.', 'v.']);
    expect(await db.words.where('posTags').equals('v.').count()).toBe(1);
    expect(await db.quizSessions.count()).toBe(0);
    expect(await db.mistakes.count()).toBe(0);
    db.close();
  });
});
