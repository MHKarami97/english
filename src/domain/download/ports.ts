import type { CachedEntry, DownloadRecord, MediaManifest } from './models';

export interface ExpectedFile {
  readonly bytes: number;
  readonly hash: string;
}

/** Port over the cache that holds downloaded media. Cache Storage in the app, a Map in tests. */
export interface MediaCachePort {
  entry(url: string): Promise<CachedEntry | null>;
  /**
   * Streams the body into the cache. Throws SizeMismatchError or StorageQuotaError and, in that
   * case, leaves nothing behind for this url.
   */
  store(url: string, response: Response, expected: ExpectedFile): Promise<void>;
  remove(url: string): Promise<boolean>;
  /** Entries whose url starts with the prefix; an empty prefix lists everything. */
  list(prefix: string): Promise<readonly CachedEntry[]>;
  removeWhere(prefix: string): Promise<number>;
}

/** Turns a manifest path into the absolute url the service worker and the cache both see. */
export interface MediaLocator {
  fileUrl(bookId: string, path: string): string | null;
  bookPrefix(bookId: string): string | null;
}

export interface MediaManifestRepository {
  get(bookId: string, options?: { readonly fresh?: boolean }): Promise<MediaManifest>;
  invalidate(bookId: string): void;
}

export interface DownloadRecordRepository {
  listByBook(bookId: string): Promise<readonly DownloadRecord[]>;
  putMany(records: readonly DownloadRecord[]): Promise<void>;
  deleteMany(unitIds: readonly string[]): Promise<void>;
  deleteByBook(bookId: string): Promise<void>;
}
