import type { CachedEntry, DownloadRecord, MediaFile, UnitMedia } from './models';

/** A cached file is stale only when a known size or hash disagrees with the manifest. */
export function isFreshEntry(entry: CachedEntry, file: MediaFile): boolean {
  const sizeOk = entry.bytes === null || file.bytes === 0 || entry.bytes === file.bytes;
  const hashOk = entry.hash === null || entry.hash === file.hash;
  return sizeOk && hashOk;
}

/**
 * The status is always derived from how many files are really in the cache, so a record can never
 * claim more than the cache holds.
 */
export function deriveRecord(
  bookId: string,
  unit: UnitMedia,
  cachedFiles: number,
  contentVersion: string,
  now: number,
  previous?: DownloadRecord,
): DownloadRecord {
  const totalFiles = unit.files.length;
  const status = totalFiles === 0 || cachedFiles >= totalFiles ? 'complete' : cachedFiles === 0 ? 'none' : 'partial';
  return {
    bookId,
    unitId: unit.unitId,
    status,
    totalFiles,
    cachedFiles: Math.min(cachedFiles, totalFiles),
    totalBytes: unit.bytes,
    completedAt: status === 'complete' ? (previous?.completedAt ?? now) : null,
    contentVersion,
  };
}

export function sameRecord(a: DownloadRecord | undefined, b: DownloadRecord): boolean {
  return (
    a !== undefined &&
    a.status === b.status &&
    a.cachedFiles === b.cachedFiles &&
    a.totalFiles === b.totalFiles &&
    a.totalBytes === b.totalBytes &&
    a.contentVersion === b.contentVersion
  );
}
