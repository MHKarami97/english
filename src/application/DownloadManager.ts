import { DOWNLOAD_REQUEST_HEADER } from '@/config/cacheNames';
import {
  CONFIRM_THRESHOLD_BYTES,
  DOWNLOAD_CONCURRENCY,
  RECORD_FLUSH_MS,
  STORAGE_SAFETY_MARGIN,
  UI_THROTTLE_MS,
} from '@/config/download';
import { DownloadQueue } from '@/domain/download/DownloadQueue';
import { HttpStatusError, ManifestUnavailableError, NotCacheableError, StorageQuotaError } from '@/domain/download/errors';
import type { CachedEntry, DownloadRecord, MediaFile, UnitMedia } from '@/domain/download/models';
import type {
  DownloadRecordRepository,
  MediaCachePort,
  MediaLocator,
  MediaManifestRepository,
} from '@/domain/download/ports';
import { deriveRecord, isFreshEntry, sameRecord } from '@/domain/download/records';
import type { RetryPolicy } from '@/domain/download/RetryPolicy';

export type DownloadPhase = 'idle' | 'running' | 'paused';

export interface PlannedFile {
  readonly url: string;
  readonly unitId: string;
  readonly file: MediaFile;
}

export interface DownloadPlan {
  readonly bookId: string;
  readonly contentVersion: string;
  readonly units: readonly UnitMedia[];
  /** Files per unit that are already cached and up to date. */
  readonly cachedByUnit: ReadonlyMap<string, number>;
  readonly missing: readonly PlannedFile[];
  readonly missingBytes: number;
  readonly totalFiles: number;
  readonly totalBytes: number;
}

export interface Preflight {
  readonly requiredBytes: number;
  /** Free space after the safety margin, or null when the browser cannot tell. */
  readonly availableBytes: number | null;
  readonly fits: boolean;
  readonly needsConfirm: boolean;
}

export interface DownloadProgress {
  readonly phase: DownloadPhase;
  readonly bookId: string | null;
  readonly doneFiles: number;
  readonly totalFiles: number;
  readonly doneBytes: number;
  readonly totalBytes: number;
  readonly failedFiles: number;
}

export interface DownloadSummary {
  readonly bookId: string;
  readonly completedFiles: number;
  readonly failedUrls: readonly string[];
  readonly quotaExceeded: boolean;
  readonly cancelled: boolean;
}

export interface StorageProbe {
  estimate(): Promise<{ readonly usage: number; readonly quota: number } | null>;
}

export interface DownloadManagerDeps {
  readonly manifests: MediaManifestRepository;
  readonly cache: MediaCachePort;
  readonly locator: MediaLocator;
  readonly records: DownloadRecordRepository;
  readonly retry: RetryPolicy;
  readonly storage: StorageProbe;
  readonly fetcher?: typeof fetch;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly now?: () => number;
}

interface Run {
  readonly plan: DownloadPlan;
  readonly queue: DownloadQueue<PlannedFile>;
  readonly cachedByUnit: Map<string, number>;
  readonly dirty: Set<string>;
  readonly done: Set<string>;
  readonly failed: string[];
  doneFiles: number;
  doneBytes: number;
  quotaExceeded: boolean;
  cancelled: boolean;
  flushTimer: ReturnType<typeof setTimeout> | null;
}

const abortableSleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });

export class DownloadManager {
  private run: Run | null = null;
  private readonly listeners = new Set<(progress: DownloadProgress) => void>();
  private lastEmit = 0;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  private readonly now: () => number;

  constructor(private readonly deps: DownloadManagerDeps) {
    this.fetcher = deps.fetcher ?? ((input, init) => fetch(input, init));
    this.sleep = deps.sleep ?? abortableSleep;
    this.now = deps.now ?? Date.now;
  }

  get isBusy(): boolean {
    return this.run !== null;
  }

  subscribe(listener: (progress: DownloadProgress) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): DownloadProgress {
    const run = this.run;
    if (!run) {
      return { phase: 'idle', bookId: null, doneFiles: 0, totalFiles: 0, doneBytes: 0, totalBytes: 0, failedFiles: 0 };
    }
    return {
      phase: run.queue.isPaused ? 'paused' : 'running',
      bookId: run.plan.bookId,
      doneFiles: run.doneFiles,
      totalFiles: run.plan.missing.length,
      doneBytes: run.doneBytes,
      totalBytes: run.plan.missingBytes,
      failedFiles: run.failed.length,
    };
  }

  /** Lists what is missing or stale. Reads a fresh manifest, so it needs the network. */
  async plan(bookId: string, unitIds?: readonly string[]): Promise<DownloadPlan> {
    const manifest = await this.deps.manifests.get(bookId, { fresh: true });
    const prefix = this.deps.locator.bookPrefix(bookId);
    if (prefix === null) throw new ManifestUnavailableError(bookId);
    const wanted = unitIds ? new Set(unitIds) : null;
    const units = manifest.units.filter((unit) => !wanted || wanted.has(unit.unitId));
    const entries = await this.entriesByUrl(prefix);

    const cachedByUnit = new Map<string, number>();
    const missing: PlannedFile[] = [];
    let totalFiles = 0;
    let totalBytes = 0;
    let missingBytes = 0;
    for (const unit of units) {
      let have = 0;
      for (const file of unit.files) {
        const url = this.deps.locator.fileUrl(bookId, file.path);
        if (url === null) throw new ManifestUnavailableError(bookId);
        totalFiles += 1;
        totalBytes += file.bytes;
        const entry = entries.get(url);
        if (entry && isFreshEntry(entry, file)) {
          have += 1;
        } else {
          missing.push({ url, unitId: unit.unitId, file });
          missingBytes += file.bytes;
        }
      }
      cachedByUnit.set(unit.unitId, have);
    }
    return { bookId, contentVersion: manifest.contentVersion, units, cachedByUnit, missing, missingBytes, totalFiles, totalBytes };
  }

  async preflight(plan: DownloadPlan): Promise<Preflight> {
    const usage = await this.deps.storage.estimate();
    const availableBytes = usage ? Math.max(0, (usage.quota - usage.usage) * (1 - STORAGE_SAFETY_MARGIN)) : null;
    return {
      requiredBytes: plan.missingBytes,
      availableBytes,
      fits: availableBytes === null || plan.missingBytes <= availableBytes,
      needsConfirm: plan.missingBytes >= CONFIRM_THRESHOLD_BYTES,
    };
  }

  /** Resolves when everything is downloaded, the run is cancelled, or storage runs out. Stays pending while paused. */
  async start(plan: DownloadPlan): Promise<DownloadSummary> {
    if (this.run) throw new Error('A download is already running.');
    const queue = new DownloadQueue<PlannedFile>({
      concurrency: DOWNLOAD_CONCURRENCY,
      worker: (item, signal) => this.download(run, item, signal),
      onError: (item, error) => this.fail(run, item, error),
    });
    const run: Run = {
      plan,
      queue,
      cachedByUnit: new Map(plan.cachedByUnit),
      dirty: new Set(),
      done: new Set(),
      failed: [],
      doneFiles: 0,
      doneBytes: 0,
      quotaExceeded: false,
      cancelled: false,
      flushTimer: null,
    };
    this.run = run;
    this.emit(true);
    try {
      queue.enqueue(plan.missing);
      await queue.drained();
    } finally {
      if (run.flushTimer) clearTimeout(run.flushTimer);
      this.run = null;
    }
    await this.reconcile(plan.bookId).catch(() => undefined);
    this.emit(true);
    return {
      bookId: plan.bookId,
      completedFiles: run.doneFiles,
      failedUrls: run.failed,
      quotaExceeded: run.quotaExceeded,
      cancelled: run.cancelled,
    };
  }

  pause(): void {
    this.run?.queue.pause();
    this.emit(true);
  }

  resume(): void {
    this.run?.queue.resume();
    this.emit(true);
  }

  cancel(): void {
    if (!this.run) return;
    this.run.cancelled = true;
    this.run.queue.cancel();
  }

  /** Compares the cache with the manifest and rewrites the stored records to match. */
  async reconcile(bookId: string): Promise<readonly DownloadRecord[]> {
    const prefix = this.deps.locator.bookPrefix(bookId);
    let manifest;
    try {
      manifest = await this.deps.manifests.get(bookId);
    } catch {
      return this.deps.records.listByBook(bookId);
    }
    if (prefix === null) return this.deps.records.listByBook(bookId);
    const entries = await this.entriesByUrl(prefix);
    const previous = new Map((await this.deps.records.listByBook(bookId)).map((record) => [record.unitId, record] as const));
    const now = this.now();
    const next = manifest.units.map((unit) =>
      deriveRecord(bookId, unit, this.countFresh(bookId, unit, entries), manifest.contentVersion, now, previous.get(unit.unitId)),
    );
    const changed = next.filter((record) => !sameRecord(previous.get(record.unitId), record));
    const known = new Set(next.map((record) => record.unitId));
    const gone = [...previous.keys()].filter((unitId) => !known.has(unitId));
    if (changed.length > 0) await this.deps.records.putMany(changed);
    if (gone.length > 0) await this.deps.records.deleteMany(gone);
    return next;
  }

  async removeUnits(bookId: string, unitIds: readonly string[]): Promise<readonly DownloadRecord[]> {
    this.assertIdle();
    const manifest = await this.deps.manifests.get(bookId);
    const wanted = new Set(unitIds);
    for (const unit of manifest.units.filter((candidate) => wanted.has(candidate.unitId))) {
      for (const file of unit.files) {
        const url = this.deps.locator.fileUrl(bookId, file.path);
        if (url !== null) await this.deps.cache.remove(url);
      }
    }
    return this.reconcile(bookId);
  }

  async removeBook(bookId: string): Promise<void> {
    this.assertIdle();
    const prefix = this.deps.locator.bookPrefix(bookId);
    if (prefix !== null) await this.deps.cache.removeWhere(prefix);
    await this.deps.records.deleteByBook(bookId);
  }

  /** Removes cached files that the current manifest no longer lists. */
  async prune(bookId: string): Promise<number> {
    const prefix = this.deps.locator.bookPrefix(bookId);
    if (prefix === null) return 0;
    const manifest = await this.deps.manifests.get(bookId);
    const listed = new Set<string>();
    manifest.units.forEach((unit) =>
      unit.files.forEach((file) => {
        const url = this.deps.locator.fileUrl(bookId, file.path);
        if (url !== null) listed.add(url);
      }),
    );
    const stale = (await this.deps.cache.list(prefix)).filter((entry) => !listed.has(entry.url));
    for (const entry of stale) await this.deps.cache.remove(entry.url);
    return stale.length;
  }

  private assertIdle(): void {
    if (this.run) throw new Error('Wait for the running download to finish first.');
  }

  private async entriesByUrl(prefix: string): Promise<Map<string, CachedEntry>> {
    return new Map((await this.deps.cache.list(prefix)).map((entry) => [entry.url, entry] as const));
  }

  private countFresh(bookId: string, unit: UnitMedia, entries: ReadonlyMap<string, CachedEntry>): number {
    let fresh = 0;
    for (const file of unit.files) {
      const url = this.deps.locator.fileUrl(bookId, file.path);
      const entry = url === null ? undefined : entries.get(url);
      if (entry && isFreshEntry(entry, file)) fresh += 1;
    }
    return fresh;
  }

  private async download(run: Run, item: PlannedFile, signal: AbortSignal): Promise<void> {
    if (run.done.has(item.url)) return;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await this.fetcher(item.url, {
          signal,
          cache: 'no-cache',
          headers: { [DOWNLOAD_REQUEST_HEADER]: '1' },
        });
        if (!response.ok) throw new HttpStatusError(response.status, item.url);
        if (response.status !== 200) throw new NotCacheableError(item.url);
        await this.deps.cache.store(item.url, response, { bytes: item.file.bytes, hash: item.file.hash });
        this.completed(run, item);
        return;
      } catch (error) {
        if (signal.aborted) return;
        if (attempt >= this.deps.retry.maxAttempts || !this.deps.retry.isRetryable(error)) throw error;
        await this.sleep(this.deps.retry.delayMs(attempt), signal);
        if (signal.aborted) return;
      }
    }
  }

  private completed(run: Run, item: PlannedFile): void {
    if (run.done.has(item.url)) return;
    run.done.add(item.url);
    run.doneFiles += 1;
    run.doneBytes += item.file.bytes;
    run.cachedByUnit.set(item.unitId, (run.cachedByUnit.get(item.unitId) ?? 0) + 1);
    run.dirty.add(item.unitId);
    this.scheduleFlush(run);
    this.emit(false);
  }

  private fail(run: Run, item: PlannedFile, error: unknown): void {
    if (error instanceof StorageQuotaError) {
      run.quotaExceeded = true;
      run.queue.cancel();
      return;
    }
    run.failed.push(item.url);
    this.emit(false);
  }

  private scheduleFlush(run: Run): void {
    if (run.flushTimer) return;
    run.flushTimer = setTimeout(() => {
      run.flushTimer = null;
      void this.flush(run).catch(() => undefined);
    }, RECORD_FLUSH_MS);
  }

  /** Writes the records of units that changed since the last flush, in one batch. */
  private async flush(run: Run): Promise<void> {
    const unitIds = [...run.dirty];
    run.dirty.clear();
    if (unitIds.length === 0) return;
    try {
      const { plan } = run;
      const previous = new Map((await this.deps.records.listByBook(plan.bookId)).map((record) => [record.unitId, record] as const));
      const now = this.now();
      const records = plan.units
        .filter((unit) => unitIds.includes(unit.unitId))
        .map((unit) => deriveRecord(plan.bookId, unit, run.cachedByUnit.get(unit.unitId) ?? 0, plan.contentVersion, now, previous.get(unit.unitId)));
      await this.deps.records.putMany(records);
    } catch (error) {
      unitIds.forEach((unitId) => run.dirty.add(unitId));
      throw error;
    }
  }

  private emit(force: boolean): void {
    const now = this.now();
    if (force || now - this.lastEmit >= UI_THROTTLE_MS) {
      this.lastEmit = now;
      if (this.emitTimer) {
        clearTimeout(this.emitTimer);
        this.emitTimer = null;
      }
      const progress = this.snapshot();
      this.listeners.forEach((listener) => listener(progress));
    } else if (!this.emitTimer) {
      this.emitTimer = setTimeout(() => {
        this.emitTimer = null;
        this.emit(true);
      }, UI_THROTTLE_MS);
    }
  }
}
