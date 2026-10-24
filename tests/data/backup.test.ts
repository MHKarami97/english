import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupError, parseBackup } from '@/data/backup/backupSchema';
import { ProgressBackupService } from '@/data/backup/ProgressBackupService';
import type { LexiDatabase } from '@/data/db/LexiDatabase';
import { makeCard, makeLog } from '../helpers/builders';
import { dropDb, openTestDb } from '../helpers/database';

let source: LexiDatabase;
let target: LexiDatabase;

beforeEach(async () => {
  source = await openTestDb();
  target = await openTestDb();
  await source.reviewCards.bulkPut([makeCard({ wordId: 'b:1:1' }), makeCard({ wordId: 'b:1:2', lastReviewedAt: 800 })]);
  await source.reviewLogs.bulkAdd([makeLog({ reviewedAt: 10 }), makeLog({ wordId: 'b:1:2', reviewedAt: 20 })]);
  await source.dailyStats.put({ dateKey: '2026-03-01', newCount: 2, reviewCount: 5, againCount: 1, totalDurationMs: 9_000 });
  await source.userWordState.put({ wordId: 'b:1:1', bookId: 'b', favorite: 1, knowledge: 'known', updatedAt: 50 });
  await source.settings.put({ key: 'newPerDay', value: 20 });
});

afterEach(async () => {
  await dropDb(source);
  await dropDb(target);
});

const serialize = async (db: LexiDatabase) => JSON.stringify(await new ProgressBackupService(db, 't').export(1));

describe('progress export and import', () => {
  it('round-trips every user table through JSON', async () => {
    const backup = parseBackup(await serialize(source));
    await new ProgressBackupService(target, 't').import(backup, 'replace');

    expect(await target.reviewCards.count()).toBe(2);
    expect((await target.reviewLogs.toArray()).map(({ id: _id, ...log }) => log)).toEqual(
      (await source.reviewLogs.toArray()).map(({ id: _id, ...log }) => log),
    );
    expect(await target.dailyStats.get('2026-03-01')).toEqual(await source.dailyStats.get('2026-03-01'));
    expect(await target.userWordState.get('b:1:1')).toEqual(await source.userWordState.get('b:1:1'));
    expect((await target.settings.get('newPerDay'))?.value).toBe(20);
  });

  it('replace removes data that is not in the file', async () => {
    await target.reviewCards.put(makeCard({ wordId: 'z:9:9' }));
    await new ProgressBackupService(target, 't').import(parseBackup(await serialize(source)), 'replace');
    expect(await target.reviewCards.get('z:9:9')).toBeUndefined();
  });

  it('merge keeps the newer record, de-duplicates logs and keeps existing settings', async () => {
    await target.reviewCards.bulkPut([
      makeCard({ wordId: 'b:1:1', lastReviewedAt: 9_000, intervalDays: 99 }),
      makeCard({ wordId: 'b:1:2', lastReviewedAt: 100, intervalDays: 1 }),
    ]);
    await target.reviewLogs.add(makeLog({ reviewedAt: 10 }));
    await target.dailyStats.put({ dateKey: '2026-03-01', newCount: 9, reviewCount: 1, againCount: 0, totalDurationMs: 1 });
    await target.settings.put({ key: 'newPerDay', value: 5 });

    const summary = await new ProgressBackupService(target, 't').import(parseBackup(await serialize(source)), 'merge');

    expect((await target.reviewCards.get('b:1:1'))?.intervalDays).toBe(99);
    expect((await target.reviewCards.get('b:1:2'))?.intervalDays).toBe(6);
    expect(await target.reviewLogs.count()).toBe(2);
    expect(summary.reviewLogs).toBe(1);
    expect(await target.dailyStats.get('2026-03-01')).toMatchObject({ newCount: 9, reviewCount: 5 });
    expect((await target.settings.get('newPerDay'))?.value).toBe(5);
  });
});

describe('parseBackup validation', () => {
  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
  });

  it('rejects files from other apps and from newer versions', async () => {
    const valid = JSON.parse(await serialize(source)) as Record<string, unknown>;
    expect(() => parseBackup(JSON.stringify({ ...valid, format: 'other' }))).toThrow('not a Easy Learn');
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 99 }))).toThrow('different version');
  });

  it('rejects a file with a malformed record and says where', async () => {
    const valid = JSON.parse(await serialize(source)) as { data: { reviewCards: Record<string, unknown>[] } };
    valid.data.reviewCards[1] = { ...valid.data.reviewCards[1], ease: 'high' };
    expect(() => parseBackup(JSON.stringify(valid))).toThrow('Entry 2 in review cards');
  });

  it('rejects a file with a missing section', async () => {
    const valid = JSON.parse(await serialize(source)) as { data: Record<string, unknown> };
    delete valid.data.dailyStats;
    expect(() => parseBackup(JSON.stringify(valid))).toThrow('daily statistics');
  });
});
