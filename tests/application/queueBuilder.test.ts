import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { interleave } from '@/application/QueueBuilder';
import type { LexiDatabase } from '@/data/db/LexiDatabase';
import { DEFAULT_STUDY_SETTINGS, emptyDailyStats, type StudySettings } from '@/domain/study/models';
import { makeCard } from '../helpers/builders';
import { FixedClock } from '../helpers/clock';
import { dropDb, openTestDb } from '../helpers/database';
import { seedBook } from '../helpers/seed';
import { createStudyKit } from '../helpers/studyKit';

let db: LexiDatabase;
let kit: ReturnType<typeof createStudyKit>;

beforeEach(async () => {
  db = await openTestDb();
  kit = createStudyKit(db, new FixedClock(Date.UTC(2026, 2, 10, 12)));
  await seedBook(db, [5, 5, 5]);
});

afterEach(async () => {
  await dropDb(db);
});

const build = (settings: Partial<StudySettings> = {}, done = emptyDailyStats('d'), extraNew = 0, dueBefore = 10_000) =>
  kit.queueBuilder.build({ bookId: 'b', settings: { ...DEFAULT_STUDY_SETTINGS, ...settings }, todayStats: done, dueBefore, extraNew });
const ids = (plan: Awaited<ReturnType<typeof build>>) => plan.entries.map((entry) => entry.wordId);

describe('interleave', () => {
  it('spreads new cards evenly among reviews', () => {
    expect(interleave(['r1', 'r2', 'r3', 'r4'], ['n1', 'n2'])).toEqual(['r1', 'r2', 'n1', 'r3', 'r4', 'n2']);
  });

  it('handles missing groups and a majority of new cards', () => {
    expect(interleave([], ['n1', 'n2'])).toEqual(['n1', 'n2']);
    expect(interleave(['r1', 'r2'], [])).toEqual(['r1', 'r2']);
    expect(interleave(['r1'], ['n1', 'n2', 'n3'])).toEqual(['r1', 'n1', 'n2', 'n3']);
  });
});

describe('new cards', () => {
  it('follow unit order and respect newPerDay minus what was introduced today', async () => {
    expect(ids(await build({ newPerDay: 7 }))).toEqual(['b:1:1', 'b:1:2', 'b:1:3', 'b:1:4', 'b:1:5', 'b:2:1', 'b:2:2']);
    const afterThree = await build({ newPerDay: 7 }, { ...emptyDailyStats('d'), newCount: 3 });
    expect(ids(afterThree)).toEqual(['b:1:1', 'b:1:2', 'b:1:3', 'b:1:4']);
  });

  it('can exceed the daily limit only through extraNew', async () => {
    const limited = { ...emptyDailyStats('d'), newCount: 2 };
    expect(ids(await build({ newPerDay: 2 }, limited))).toEqual([]);
    expect(ids(await build({ newPerDay: 2 }, limited, 3))).toHaveLength(3);
  });

  it('stay inside activeUnitIds', async () => {
    const plan = await build({ newPerDay: 20, activeUnitIds: ['b:2'] });
    expect(ids(plan)).toEqual(['b:2:1', 'b:2:2', 'b:2:3', 'b:2:4', 'b:2:5']);
  });

  it('skip known words only when skipKnownWords is on, and never skip unknown ones', async () => {
    await db.userWordState.bulkPut([
      { wordId: 'b:1:1', bookId: 'b', favorite: 0, knowledge: 'known', updatedAt: 1 },
      { wordId: 'b:1:2', bookId: 'b', favorite: 0, knowledge: 'unknown', updatedAt: 1 },
    ]);
    expect(ids(await build({ newPerDay: 3, skipKnownWords: true }))).toEqual(['b:1:2', 'b:1:3', 'b:1:4']);
    expect(ids(await build({ newPerDay: 3, skipKnownWords: false }))).toEqual(['b:1:1', 'b:1:2', 'b:1:3']);
  });

  it('exclude words that already have a review card', async () => {
    await db.reviewCards.put(makeCard({ wordId: 'b:1:2', dueAt: 99_999 }));
    expect(ids(await build({ newPerDay: 2 }))).toEqual(['b:1:1', 'b:1:3']);
  });

  it('shuffle reproducibly with a seeded random source and keep the same set', async () => {
    const settings = { newPerDay: 15, newCardOrder: 'random' as const };
    const first = ids(await build(settings));
    const secondKit = createStudyKit(db, new FixedClock(0), 1);
    const second = (
      await secondKit.queueBuilder.build({ bookId: 'b', settings: { ...DEFAULT_STUDY_SETTINGS, ...settings }, todayStats: emptyDailyStats('d'), dueBefore: 1 })
    ).entries.map((entry) => entry.wordId);
    expect(second).toEqual(first);
    expect([...first].sort()).toEqual(ids(await build({ newPerDay: 15 })).sort());
  });
});

describe('due reviews', () => {
  beforeEach(async () => {
    await db.reviewCards.bulkPut([
      makeCard({ wordId: 'b:1:1', dueAt: 300 }),
      makeCard({ wordId: 'b:1:2', dueAt: 100 }),
      makeCard({ wordId: 'b:1:3', dueAt: 200 }),
      makeCard({ wordId: 'b:1:4', dueAt: 20_000 }),
    ]);
  });

  it('come oldest first and are limited by maxReviewsPerDay minus reviews done today', async () => {
    const plan = await build({ maxReviewsPerDay: 2, newPerDay: 0 });
    expect(ids(plan)).toEqual(['b:1:2', 'b:1:3']);
    expect(plan.dueTotal).toBe(3);
    const oneDone = await build({ maxReviewsPerDay: 2, newPerDay: 0 }, { ...emptyDailyStats('d'), reviewCount: 1 });
    expect(ids(oneDone)).toEqual(['b:1:2']);
    expect(ids(await build({ maxReviewsPerDay: 2, newPerDay: 0 }, { ...emptyDailyStats('d'), reviewCount: 2 }))).toEqual([]);
  });

  it('ignore orphan cards whose word no longer exists', async () => {
    await db.reviewCards.put(makeCard({ wordId: 'b:9:9', unitId: 'b:9', dueAt: 50 }));
    const plan = await build({ newPerDay: 0 });
    expect(ids(plan)).toEqual(['b:1:2', 'b:1:3', 'b:1:1']);
    expect(plan.reviewCount).toBe(3);
  });

  it('mix with new cards at an even ratio', async () => {
    const plan = await build({ newPerDay: 3, activeUnitIds: ['b:3'] });
    expect(plan.entries.map((entry) => entry.kind)).toEqual(['review', 'new', 'review', 'new', 'review', 'new']);
  });
});
