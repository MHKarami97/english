import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LexiDatabase } from '@/data/db/LexiDatabase';
import { makeCard } from '../helpers/builders';
import { FixedClock } from '../helpers/clock';
import { dropDb, openTestDb } from '../helpers/database';
import { seedBook } from '../helpers/seed';
import { createStudyKit } from '../helpers/studyKit';

const noon = Date.UTC(2026, 2, 10, 12, 0);
const today = '2026-03-10';

let db: LexiDatabase;
let clock: FixedClock;
let kit: ReturnType<typeof createStudyKit>;

beforeEach(async () => {
  db = await openTestDb();
  clock = new FixedClock(noon);
  kit = createStudyKit(db, clock);
  await seedBook(db, [3]);
});

afterEach(async () => {
  await dropDb(db);
});

async function answerNext(session: ReturnType<typeof kit.newSession>, rating: 'again' | 'hard' | 'good' | 'easy') {
  session.reveal();
  return session.answer(rating);
}

describe('answering', () => {
  it('schedules a new card, writes the log and updates daily counters', async () => {
    const session = kit.newSession();
    let view = await session.start('b');
    expect(view).toMatchObject({ status: 'active', remaining: 3, resumed: false });
    expect(view.current).toMatchObject({ kind: 'new', drill: false });
    expect(view.current?.word.id).toBe('b:1:1');

    expect(session.reveal().preview?.good.days).toBe(1);
    clock.advance(5_000);
    view = await session.answer('good');

    expect(await kit.cards.get('b:1:1')).toMatchObject({
      state: 'review',
      intervalDays: 1,
      repetitions: 1,
      dueAt: Date.UTC(2026, 2, 11, 4, 0),
    });
    expect(await db.reviewLogs.count()).toBe(1);
    expect(await kit.stats.get(today)).toMatchObject({ newCount: 1, reviewCount: 0, totalDurationMs: 5_000 });
    expect(view.current?.word.id).toBe('b:1:2');
    expect(view.remaining).toBe(2);
  });

  it('ignores an answer before the card is revealed', async () => {
    const session = kit.newSession();
    await session.start('b');
    await session.answer('good');
    expect(await db.reviewLogs.count()).toBe(0);
  });

  it('hides interval previews when the setting is off', async () => {
    await kit.settings.update({ showIntervalsOnButtons: false });
    const session = kit.newSession();
    await session.start('b');
    expect(session.reveal().preview).toBeNull();
  });
});

describe('in-session repeats', () => {
  it('brings an Again card back after a few others and does not reschedule it again', async () => {
    const session = kit.newSession();
    await session.start('b');
    let view = await answerNext(session, 'again');
    expect(view.remaining).toBe(3);
    expect(await kit.cards.get('b:1:1')).toMatchObject({ state: 'learning', intervalDays: 1 });

    view = await answerNext(session, 'good');
    view = await answerNext(session, 'good');
    expect(view.current).toMatchObject({ drill: true });
    expect(view.current?.word.id).toBe('b:1:1');
    expect(view.preview).toBeNull();

    view = await answerNext(session, 'good');
    expect(view.status).toBe('finished');
    expect(await db.reviewLogs.count()).toBe(3);
  });

  it('repeats Hard once on a new card but not on a review card', async () => {
    const newCard = kit.newSession();
    await newCard.start('b');
    expect((await answerNext(newCard, 'hard')).remaining).toBe(3);

    await db.reviewCards.put(makeCard({ wordId: 'b:1:3', unitId: 'b:1', dueAt: Date.UTC(2026, 2, 10, 4, 0) }));
    await kit.state.set('studySession', null);
    const review = kit.newSession();
    const first = await review.start('b');
    expect(first.current).toMatchObject({ kind: 'review' });
    expect((await answerNext(review, 'hard')).remaining).toBe(first.remaining - 1);
  });
});

describe('undo', () => {
  it('removes a new card, its log and its counters, and shows the card again', async () => {
    const session = kit.newSession();
    await session.start('b');
    await answerNext(session, 'good');
    const view = await session.undo();

    expect(await kit.cards.get('b:1:1')).toBeUndefined();
    expect(await db.reviewLogs.count()).toBe(0);
    expect(await kit.stats.get(today)).toMatchObject({ newCount: 0, totalDurationMs: 0 });
    expect(view).toMatchObject({ remaining: 3, revealed: false, canUndo: false, answered: 0 });
    expect(view.current?.word.id).toBe('b:1:1');
  });

  it('restores the previous schedule of a review card', async () => {
    const before = makeCard({ wordId: 'b:1:1', dueAt: Date.UTC(2026, 2, 10, 4, 0) });
    await db.reviewCards.put(before);
    const session = kit.newSession();
    await session.start('b');
    await answerNext(session, 'easy');
    expect((await kit.cards.get('b:1:1'))?.intervalDays).not.toBe(before.intervalDays);
    await session.undo();
    expect(await kit.cards.get('b:1:1')).toEqual(before);
    expect((await kit.stats.get(today))?.reviewCount).toBe(0);
  });

  it('undoes an in-session repeat without touching the database', async () => {
    const session = kit.newSession();
    await session.start('b');
    await answerNext(session, 'again');
    await answerNext(session, 'good');
    await answerNext(session, 'good');
    await answerNext(session, 'good');
    const logs = await db.reviewLogs.count();
    const view = await session.undo();
    expect(view.current).toMatchObject({ drill: true });
    expect(await db.reviewLogs.count()).toBe(logs);
  });

  it('does nothing when there is nothing to undo', async () => {
    const session = kit.newSession();
    await session.start('b');
    expect((await session.undo()).canUndo).toBe(false);
  });
});

describe('resume and finish', () => {
  it('continues with the remaining cards after a reload', async () => {
    const first = kit.newSession();
    await first.start('b');
    await answerNext(first, 'good');

    const view = await kit.newSession().start('b');
    expect(view).toMatchObject({ resumed: true, remaining: 2 });
    expect(view.current?.word.id).toBe('b:1:2');
  });

  it('drops queued words that no longer exist', async () => {
    await kit.state.set('studySession', {
      bookId: 'b',
      dayKey: today,
      queue: [
        { wordId: 'b:9:9', kind: 'new' },
        { wordId: 'b:1:2', kind: 'new' },
      ],
      total: 2,
      tally: { answered: 0, byRating: { again: 0, hard: 0, good: 0, easy: 0 }, durationMs: 0 },
    });
    const view = await kit.newSession().start('b');
    expect(view).toMatchObject({ resumed: true, remaining: 1 });
  });

  it('ignores a saved session from another study day', async () => {
    const first = kit.newSession();
    await first.start('b');
    await answerNext(first, 'good');
    clock.set(noon + 24 * 3_600_000);
    const view = await kit.newSession().start('b');
    expect(view.resumed).toBe(false);
  });

  it('clears the saved session and summarises the run when the queue is empty', async () => {
    const session = kit.newSession();
    await session.start('b');
    await answerNext(session, 'good');
    await answerNext(session, 'again');
    await answerNext(session, 'easy');
    const view = await answerNext(session, 'good');
    expect(view.status).toBe('finished');
    expect(await kit.state.get('studySession', 'missing')).toBeNull();

    const summary = await session.summary();
    expect(summary.answered).toBe(3);
    expect(summary.byRating).toEqual({ again: 1, hard: 0, good: 1, easy: 1 });
    expect(summary.accuracy).toBeCloseTo(2 / 3);
    expect(summary.nextDueAt).toBe(Date.UTC(2026, 2, 11, 4, 0));
  });

  it('finishes immediately with an empty queue', async () => {
    await db.words.clear();
    await db.units.clear();
    const session = kit.newSession();
    const view = await session.start('b');
    expect(view).toMatchObject({ status: 'finished', remaining: 0 });
    expect((await session.summary()).answered).toBe(0);
  });

  it('starts an extra session beyond the daily new-card limit', async () => {
    await kit.settings.update({ newPerDay: 1 });
    const first = kit.newSession();
    await first.start('b');
    await answerNext(first, 'good');
    await kit.state.set('studySession', null);
    expect((await kit.newSession().start('b')).remaining).toBe(0);
    expect((await kit.newSession().start('b', { extraNew: 2 })).remaining).toBe(2);
  });
});
