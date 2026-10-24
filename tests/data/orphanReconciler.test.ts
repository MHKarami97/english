import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OrphanReconciler } from '@/data/download/OrphanReconciler';
import { LexiDatabase } from '@/data/db/LexiDatabase';

let db: LexiDatabase;

const word = (id: string) => ({ id, bookId: 'b', unitId: 'b:1', posTags: [] });

beforeEach(async () => {
  db = new LexiDatabase(`test-orphans-${Math.random()}`);
  await db.words.bulkPut([word('b:w1')] as never);
  await db.reviewCards.bulkPut([
    { wordId: 'b:w1', bookId: 'b', unitId: 'b:1' },
    { wordId: 'b:w2', bookId: 'b', unitId: 'b:1' },
  ] as never);
  await db.mistakes.bulkPut([{ wordId: 'b:w2', lastWrongAt: 1 }] as never);
});

afterEach(async () => {
  await db.delete();
});

describe('OrphanReconciler', () => {
  it('moves cards and mistakes of vanished words aside and leaves the rest alone', async () => {
    const report = await new OrphanReconciler(db).reconcile('b');
    expect(report).toEqual({ removed: 2, restored: 0 });
    expect((await db.reviewCards.toArray()).map((card) => card.wordId)).toEqual(['b:w1']);
    expect(await db.mistakes.count()).toBe(0);
  });

  it('brings them back when the word returns', async () => {
    const reconciler = new OrphanReconciler(db);
    await reconciler.reconcile('b');
    await db.words.bulkPut([word('b:w2')] as never);
    const report = await reconciler.reconcile('b');
    expect(report).toEqual({ removed: 0, restored: 2 });
    expect(await db.reviewCards.count()).toBe(2);
    expect(await db.mistakes.count()).toBe(1);
  });

  it('does nothing when every word still exists', async () => {
    await db.words.bulkPut([word('b:w2')] as never);
    expect(await new OrphanReconciler(db).reconcile('b')).toEqual({ removed: 0, restored: 0 });
    expect(await db.reviewCards.count()).toBe(2);
  });
});
