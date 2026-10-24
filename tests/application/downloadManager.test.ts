import { describe, expect, it } from 'vitest';
import { DownloadManager } from '@/application/DownloadManager';
import { DOWNLOAD_REQUEST_HEADER } from '@/config/cacheNames';
import { StorageQuotaError } from '@/domain/download/errors';
import type { CachedEntry, DownloadRecord, MediaFile, MediaManifest } from '@/domain/download/models';
import type {
  DownloadRecordRepository,
  ExpectedFile,
  MediaCachePort,
  MediaLocator,
  MediaManifestRepository,
} from '@/domain/download/ports';
import { ExponentialBackoffRetryPolicy } from '@/domain/download/RetryPolicy';

const BOOK = 'b';
const PREFIX = 'https://x.test/data/b/';
const urlOf = (name: string): string => `${PREFIX}audio/${name}`;
const file = (name: string): MediaFile => ({ path: `audio/${name}`, kind: 'audio', bytes: 10, hash: `h-${name}` });

const manifest: MediaManifest = {
  bookId: BOOK,
  contentVersion: 'v1',
  dataHash: 'd1',
  totals: { files: 3, bytes: 30 },
  units: [
    { unitId: 'b:1', bytes: 20, files: [file('a.mp3'), file('b.mp3')] },
    { unitId: 'b:2', bytes: 10, files: [file('c.mp3')] },
  ],
};

class MemoryCache implements MediaCachePort {
  readonly files = new Map<string, CachedEntry>();

  async entry(url: string): Promise<CachedEntry | null> {
    return this.files.get(url) ?? null;
  }

  async store(url: string, _response: Response, expected: ExpectedFile): Promise<void> {
    this.files.set(url, { url, bytes: expected.bytes, hash: expected.hash });
  }

  async remove(url: string): Promise<boolean> {
    return this.files.delete(url);
  }

  async list(prefix: string): Promise<readonly CachedEntry[]> {
    return [...this.files.values()].filter((entry) => entry.url.startsWith(prefix));
  }

  async removeWhere(prefix: string): Promise<number> {
    const matching = [...this.files.keys()].filter((url) => url.startsWith(prefix));
    matching.forEach((url) => this.files.delete(url));
    return matching.length;
  }
}

class FullDiskCache extends MemoryCache {
  override async store(url: string, response: Response, expected: ExpectedFile): Promise<void> {
    if (url.endsWith('b.mp3')) throw new StorageQuotaError();
    return super.store(url, response, expected);
  }
}

class MemoryRecords implements DownloadRecordRepository {
  readonly rows = new Map<string, DownloadRecord>();

  async listByBook(bookId: string): Promise<readonly DownloadRecord[]> {
    return [...this.rows.values()].filter((row) => row.bookId === bookId);
  }

  async putMany(records: readonly DownloadRecord[]): Promise<void> {
    records.forEach((record) => this.rows.set(record.unitId, record));
  }

  async deleteMany(unitIds: readonly string[]): Promise<void> {
    unitIds.forEach((unitId) => this.rows.delete(unitId));
  }

  async deleteByBook(bookId: string): Promise<void> {
    [...this.rows.values()].filter((row) => row.bookId === bookId).forEach((row) => this.rows.delete(row.unitId));
  }
}

const locator: MediaLocator = { fileUrl: (_bookId, path) => `${PREFIX}${path}`, bookPrefix: () => PREFIX };
const manifests: MediaManifestRepository = { get: async () => manifest, invalidate: () => undefined };

const okFetcher = (async () => new Response('x')) as unknown as typeof fetch;

function countingFetcher(respond: (url: string, attempt: number) => Response): {
  fetcher: typeof fetch;
  attempts: Map<string, number>;
} {
  const attempts = new Map<string, number>();
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const attempt = (attempts.get(url) ?? 0) + 1;
    attempts.set(url, attempt);
    return respond(url, attempt);
  }) as unknown as typeof fetch;
  return { fetcher, attempts };
}

interface SetupOptions {
  readonly cache?: MemoryCache;
  readonly fetcher?: typeof fetch;
  readonly usage?: { usage: number; quota: number } | null;
}

function setup(options: SetupOptions = {}) {
  const cache = options.cache ?? new MemoryCache();
  const records = new MemoryRecords();
  const usage = options.usage === undefined ? { usage: 0, quota: 1_000_000 } : options.usage;
  const manager = new DownloadManager({
    manifests,
    cache,
    locator,
    records,
    retry: new ExponentialBackoffRetryPolicy({ next: () => 0 }, 2),
    storage: { estimate: async () => usage },
    fetcher: options.fetcher ?? okFetcher,
    sleep: async () => undefined,
    now: () => 1000,
  });
  return { manager, cache, records };
}

const statusOf = async (records: MemoryRecords, unitId: string): Promise<string | undefined> =>
  (await records.listByBook(BOOK)).find((record) => record.unitId === unitId)?.status;

describe('DownloadManager.plan', () => {
  it('lists every file and its size when nothing is cached', async () => {
    const { manager } = setup();
    const plan = await manager.plan(BOOK);
    expect(plan.missing).toHaveLength(3);
    expect(plan.missingBytes).toBe(30);
    expect(plan.totalFiles).toBe(3);
  });

  it('skips files that are cached and current, and lists stale ones again', async () => {
    const { manager, cache } = setup();
    cache.files.set(urlOf('a.mp3'), { url: urlOf('a.mp3'), bytes: 10, hash: 'h-a.mp3' });
    const fresh = await manager.plan(BOOK);
    expect(fresh.missing).toHaveLength(2);
    expect(fresh.cachedByUnit.get('b:1')).toBe(1);

    cache.files.set(urlOf('a.mp3'), { url: urlOf('a.mp3'), bytes: 10, hash: 'old' });
    expect((await manager.plan(BOOK)).missing).toHaveLength(3);
  });

  it('plans only the units that were asked for', async () => {
    const { manager } = setup();
    const plan = await manager.plan(BOOK, ['b:2']);
    expect(plan.missing.map((item) => item.unitId)).toEqual(['b:2']);
  });
});

describe('DownloadManager.preflight', () => {
  it('fits when enough space is left after the safety margin', async () => {
    const { manager } = setup({ usage: { usage: 0, quota: 1000 } });
    const check = await manager.preflight(await manager.plan(BOOK));
    expect(check.fits).toBe(true);
    expect(check.availableBytes).toBe(800);
    expect(check.needsConfirm).toBe(false);
  });

  it('does not fit when the space is too small, and fits when the browser cannot tell', async () => {
    const tight = setup({ usage: { usage: 999_990, quota: 1_000_000 } });
    expect((await tight.manager.preflight(await tight.manager.plan(BOOK))).fits).toBe(false);
    const unknown = setup({ usage: null });
    const check = await unknown.manager.preflight(await unknown.manager.plan(BOOK));
    expect(check.fits).toBe(true);
    expect(check.availableBytes).toBeNull();
  });

  it('asks for confirmation on large downloads', async () => {
    const { manager } = setup();
    const plan = await manager.plan(BOOK);
    const check = await manager.preflight({ ...plan, missingBytes: 60 * 1024 * 1024 });
    expect(check.needsConfirm).toBe(true);
  });
});

describe('DownloadManager.start', () => {
  it('downloads everything and records complete units', async () => {
    const { manager, cache, records } = setup();
    const summary = await manager.start(await manager.plan(BOOK));
    expect(summary.completedFiles).toBe(3);
    expect(summary.failedUrls).toEqual([]);
    expect(cache.files.size).toBe(3);
    expect(await statusOf(records, 'b:1')).toBe('complete');
    expect(await statusOf(records, 'b:2')).toBe('complete');
  });

  it('marks its requests so the service worker sends them straight to the network', async () => {
    const seen: Array<HeadersInit | undefined> = [];
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init?.headers);
      return new Response('x');
    }) as unknown as typeof fetch;
    const { manager } = setup({ fetcher });
    await manager.start(await manager.plan(BOOK));
    expect(seen).toHaveLength(3);
    seen.forEach((headers) => expect(headers).toEqual({ [DOWNLOAD_REQUEST_HEADER]: '1' }));
  });

  it('retries a failing file and succeeds on the second attempt', async () => {
    const { fetcher, attempts } = countingFetcher((url, attempt) =>
      url.endsWith('a.mp3') && attempt === 1 ? new Response('', { status: 503 }) : new Response('x'),
    );
    const { manager, cache } = setup({ fetcher });
    const summary = await manager.start(await manager.plan(BOOK));
    expect(attempts.get(urlOf('a.mp3'))).toBe(2);
    expect(summary.failedUrls).toEqual([]);
    expect(cache.files.size).toBe(3);
  });

  it('gives up on a file that keeps failing and records the unit as partial', async () => {
    const { fetcher, attempts } = countingFetcher((url) =>
      url.endsWith('b.mp3') ? new Response('', { status: 500 }) : new Response('x'),
    );
    const { manager, records } = setup({ fetcher });
    const summary = await manager.start(await manager.plan(BOOK));
    expect(attempts.get(urlOf('b.mp3'))).toBe(2);
    expect(summary.failedUrls).toEqual([urlOf('b.mp3')]);
    expect(summary.completedFiles).toBe(2);
    expect(await statusOf(records, 'b:1')).toBe('partial');
    expect(await statusOf(records, 'b:2')).toBe('complete');
  });

  it('does not retry a missing file', async () => {
    const { fetcher, attempts } = countingFetcher((url) =>
      url.endsWith('c.mp3') ? new Response('', { status: 404 }) : new Response('x'),
    );
    const { manager } = setup({ fetcher });
    const summary = await manager.start(await manager.plan(BOOK));
    expect(attempts.get(urlOf('c.mp3'))).toBe(1);
    expect(summary.failedUrls).toEqual([urlOf('c.mp3')]);
  });

  it('stops when the disk is full and keeps records equal to what is really cached', async () => {
    const cache = new FullDiskCache();
    const { manager, records } = setup({ cache });
    const summary = await manager.start(await manager.plan(BOOK));
    expect(summary.quotaExceeded).toBe(true);
    expect(summary.failedUrls).toEqual([]);
    const cachedInRecords = (await records.listByBook(BOOK)).reduce((sum, record) => sum + record.cachedFiles, 0);
    expect(cachedInRecords).toBe(cache.files.size);
  });

  it('refuses to start a second download while one is running', async () => {
    const { manager } = setup();
    const plan = await manager.plan(BOOK);
    const first = manager.start(plan);
    await expect(manager.start(plan)).rejects.toThrow();
    await first;
  });
});

describe('DownloadManager bookkeeping', () => {
  it('removes the files of a unit and records it as not downloaded', async () => {
    const { manager, cache, records } = setup();
    await manager.start(await manager.plan(BOOK));
    await manager.removeUnits(BOOK, ['b:1']);
    expect(cache.files.size).toBe(1);
    expect(await statusOf(records, 'b:1')).toBe('none');
    expect(await statusOf(records, 'b:2')).toBe('complete');
  });

  it('removes every file of the book and its records', async () => {
    const { manager, cache, records } = setup();
    await manager.start(await manager.plan(BOOK));
    await manager.removeBook(BOOK);
    expect(cache.files.size).toBe(0);
    expect(await records.listByBook(BOOK)).toEqual([]);
  });

  it('prunes cached files the manifest no longer lists', async () => {
    const { manager, cache } = setup();
    await manager.start(await manager.plan(BOOK));
    cache.files.set(urlOf('old.mp3'), { url: urlOf('old.mp3'), bytes: 10, hash: 'x' });
    expect(await manager.prune(BOOK)).toBe(1);
    expect(cache.files.has(urlOf('old.mp3'))).toBe(false);
    expect(cache.files.size).toBe(3);
  });

  it('corrects a record that claims more than the cache holds', async () => {
    const { manager, records } = setup();
    await records.putMany([
      { bookId: BOOK, unitId: 'b:1', status: 'complete', totalFiles: 2, cachedFiles: 2, totalBytes: 20, completedAt: 1, contentVersion: 'v1' },
    ]);
    await manager.reconcile(BOOK);
    expect(await statusOf(records, 'b:1')).toBe('none');
  });
});
