import { describe, expect, it } from 'vitest';
import type { DownloadRecord, MediaFile, UnitMedia } from '@/domain/download/models';
import { deriveRecord, isFreshEntry, sameRecord } from '@/domain/download/records';

const file = (name: string): MediaFile => ({ path: `audio/${name}`, kind: 'audio', bytes: 10, hash: `h-${name}` });
const unit: UnitMedia = { unitId: 'b:1', bytes: 20, files: [file('a.mp3'), file('b.mp3')] };

describe('deriveRecord', () => {
  it('is none when nothing is cached', () => {
    const record = deriveRecord('b', unit, 0, 'v1', 100);
    expect(record.status).toBe('none');
    expect(record.completedAt).toBeNull();
  });

  it('is partial while some files are missing', () => {
    const record = deriveRecord('b', unit, 1, 'v1', 100);
    expect(record.status).toBe('partial');
    expect(record.cachedFiles).toBe(1);
    expect(record.totalFiles).toBe(2);
  });

  it('is complete with a completion time, and keeps the first completion time', () => {
    const first = deriveRecord('b', unit, 2, 'v1', 100);
    expect(first.status).toBe('complete');
    expect(first.completedAt).toBe(100);
    expect(deriveRecord('b', unit, 2, 'v1', 900, first).completedAt).toBe(100);
  });

  it('never claims more files than the unit has, and an empty unit is complete', () => {
    expect(deriveRecord('b', unit, 5, 'v1', 1).cachedFiles).toBe(2);
    expect(deriveRecord('b', { unitId: 'b:2', bytes: 0, files: [] }, 0, 'v1', 1).status).toBe('complete');
  });
});

describe('isFreshEntry', () => {
  const a = file('a.mp3');

  it('accepts an entry whose size and hash are unknown', () => {
    expect(isFreshEntry({ url: 'u', bytes: null, hash: null }, a)).toBe(true);
  });

  it('accepts a matching entry', () => {
    expect(isFreshEntry({ url: 'u', bytes: 10, hash: 'h-a.mp3' }, a)).toBe(true);
  });

  it('rejects a different size or a different hash', () => {
    expect(isFreshEntry({ url: 'u', bytes: 11, hash: 'h-a.mp3' }, a)).toBe(false);
    expect(isFreshEntry({ url: 'u', bytes: 10, hash: 'old' }, a)).toBe(false);
  });

  it('ignores the size when the manifest does not know it', () => {
    expect(isFreshEntry({ url: 'u', bytes: 99, hash: 'h-a.mp3' }, { ...a, bytes: 0 })).toBe(true);
  });
});

describe('sameRecord', () => {
  it('compares the fields that matter and ignores the completion time', () => {
    const record: DownloadRecord = deriveRecord('b', unit, 2, 'v1', 100);
    expect(sameRecord(record, { ...record, completedAt: 5 })).toBe(true);
    expect(sameRecord(record, { ...record, cachedFiles: 1 })).toBe(false);
    expect(sameRecord(undefined, record)).toBe(false);
  });
});
