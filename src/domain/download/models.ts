export type MediaKind = 'audio' | 'image';

export interface MediaFile {
  /** Path inside the book folder, for example "audio/apple.mp3" (not URL-encoded). */
  readonly path: string;
  readonly kind: MediaKind;
  readonly bytes: number;
  /** First 16 hex characters of the SHA-256 of the file. */
  readonly hash: string;
}

export interface UnitMedia {
  readonly unitId: string;
  readonly bytes: number;
  readonly files: readonly MediaFile[];
}

export interface MediaManifest {
  readonly bookId: string;
  /** Hash over data.json and the list of files with their sizes and hashes. */
  readonly contentVersion: string;
  /** SHA-256 of data.json, the same value the importer stores as the book version. */
  readonly dataHash: string;
  readonly totals: { readonly files: number; readonly bytes: number };
  readonly units: readonly UnitMedia[];
}

export type DownloadStatus = 'none' | 'partial' | 'complete';

export interface DownloadRecord {
  readonly bookId: string;
  readonly unitId: string;
  readonly status: DownloadStatus;
  readonly totalFiles: number;
  readonly cachedFiles: number;
  readonly totalBytes: number;
  readonly completedAt: number | null;
  readonly contentVersion: string;
}

export interface CachedEntry {
  readonly url: string;
  readonly bytes: number | null;
  readonly hash: string | null;
}
