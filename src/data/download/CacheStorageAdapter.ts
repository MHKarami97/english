import { CacheName, MEDIA_BYTES_HEADER, MEDIA_HASH_HEADER } from '@/config/cacheNames';
import { SizeMismatchError, StorageQuotaError } from '@/domain/download/errors';
import type { CachedEntry } from '@/domain/download/models';
import type { ExpectedFile, MediaCachePort } from '@/domain/download/ports';

const QUOTA_ERROR_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);
const LIST_CHUNK = 50;

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException && (QUOTA_ERROR_NAMES.has(error.name) || error.code === 22);

function toEntry(url: string, response: Response): CachedEntry {
  const bytes = Number(response.headers.get(MEDIA_BYTES_HEADER) ?? response.headers.get('content-length'));
  return { url, bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : null, hash: response.headers.get(MEDIA_HASH_HEADER) };
}

/** The real MediaCachePort. Bodies stream straight into Cache Storage and are never held in memory. */
export class CacheStorageAdapter implements MediaCachePort {
  constructor(private readonly cacheName: string = CacheName.media) {}

  private open(): Promise<Cache> {
    return caches.open(this.cacheName);
  }

  async entry(url: string): Promise<CachedEntry | null> {
    const hit = await (await this.open()).match(url);
    return hit ? toEntry(url, hit) : null;
  }

  async store(url: string, response: Response, expected: ExpectedFile): Promise<void> {
    if (!response.body) throw new SizeMismatchError(url, expected.bytes, 0);
    const verify = expected.bytes > 0;
    const declared = Number(response.headers.get('content-length'));
    if (verify && declared > 0 && !response.headers.has('content-encoding') && declared !== expected.bytes) {
      throw new SizeMismatchError(url, expected.bytes, declared);
    }

    let counted = 0;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        counted += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    // The body is already decoded, so the encoding and length headers of the original no longer apply.
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set(MEDIA_HASH_HEADER, expected.hash);
    headers.set(MEDIA_BYTES_HEADER, String(expected.bytes));

    const cache = await this.open();
    try {
      await cache.put(url, new Response(response.body.pipeThrough(counter), { status: 200, statusText: 'OK', headers }));
    } catch (error) {
      await cache.delete(url).catch(() => false);
      throw isQuotaError(error) ? new StorageQuotaError() : error;
    }
    if (verify && counted !== expected.bytes) {
      await cache.delete(url);
      throw new SizeMismatchError(url, expected.bytes, counted);
    }
  }

  async remove(url: string): Promise<boolean> {
    return (await this.open()).delete(url);
  }

  async list(prefix: string): Promise<readonly CachedEntry[]> {
    const cache = await this.open();
    const requests = (await cache.keys()).filter((request) => request.url.startsWith(prefix));
    const entries: CachedEntry[] = [];
    for (let start = 0; start < requests.length; start += LIST_CHUNK) {
      const chunk = requests.slice(start, start + LIST_CHUNK);
      const found = await Promise.all(
        chunk.map(async (request) => {
          const hit = await cache.match(request);
          return hit ? toEntry(request.url, hit) : null;
        }),
      );
      entries.push(...found.filter((entry): entry is CachedEntry => entry !== null));
    }
    return entries;
  }

  async removeWhere(prefix: string): Promise<number> {
    const cache = await this.open();
    const requests = (await cache.keys()).filter((request) => request.url.startsWith(prefix));
    await Promise.all(requests.map((request) => cache.delete(request)));
    return requests.length;
  }
}
