import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { LexiDatabase } from '@/data/db/LexiDatabase';

const name = 'migration-test-db';

afterEach(async () => {
  await Dexie.delete(name);
});

describe('Dexie v1 to v2 migration', () => {
  it('keeps Phase 1 user data and adds empty review tables', async () => {
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      books: 'id',
      units: 'id, bookId',
      words: 'id, bookId, unitId',
      userWordState: 'wordId, bookId, [bookId+knowledge], [bookId+favorite]',
      settings: 'key',
      importState: 'bookId',
    });
    await legacy.table('userWordState').bulkPut([
      { wordId: 'b:1:1', bookId: 'b', favorite: 1, knowledge: 'known', updatedAt: 10 },
      { wordId: 'b:1:2', bookId: 'b', favorite: 0, knowledge: 'unknown', updatedAt: 20 },
    ]);
    await legacy.table('settings').put({ key: 'autoPlayOnFlip', value: true });
    legacy.close();

    const db = new LexiDatabase(name);
    await db.open();

    expect(db.verno).toBe(2);
    expect(await db.userWordState.count()).toBe(2);
    expect((await db.userWordState.get('b:1:1'))?.favorite).toBe(1);
    expect(await db.userWordState.where('[bookId+favorite]').equals(['b', 1]).primaryKeys()).toEqual(['b:1:1']);
    expect(await db.userWordState.where('[bookId+knowledge]').equals(['b', 'unknown']).count()).toBe(1);
    expect((await db.settings.get('autoPlayOnFlip'))?.value).toBe(true);
    expect(await db.reviewCards.count()).toBe(0);
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await db.dailyStats.count()).toBe(0);
    db.close();
  });
});
