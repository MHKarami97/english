import type { BookRepository } from '@/domain/contracts';
import { ManifestUnavailableError } from '@/domain/download/errors';
import type { MediaManifest } from '@/domain/download/models';
import type { MediaManifestRepository } from '@/domain/download/ports';

function isManifest(value: unknown): value is MediaManifest {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Partial<MediaManifest>;
  return (
    typeof manifest.bookId === 'string' &&
    typeof manifest.contentVersion === 'string' &&
    typeof manifest.dataHash === 'string' &&
    Array.isArray(manifest.units)
  );
}

export class HttpMediaManifestRepository implements MediaManifestRepository {
  private readonly loaded = new Map<string, Promise<MediaManifest>>();

  constructor(
    private readonly books: BookRepository,
    private readonly baseUrl: string = import.meta.env.BASE_URL,
  ) {}

  get(bookId: string, options: { readonly fresh?: boolean } = {}): Promise<MediaManifest> {
    if (options.fresh) this.loaded.delete(bookId);
    let pending = this.loaded.get(bookId);
    if (!pending) {
      pending = this.load(bookId);
      this.loaded.set(bookId, pending);
      // A failure (offline, no manifest yet) must not be remembered.
      pending.catch(() => this.loaded.delete(bookId));
    }
    return pending;
  }

  invalidate(bookId: string): void {
    this.loaded.delete(bookId);
  }

  private async load(bookId: string): Promise<MediaManifest> {
    const book = (await this.books.list()).find((candidate) => candidate.id === bookId);
    if (!book) throw new ManifestUnavailableError(bookId);
    const response = await fetch(`${this.baseUrl}${book.path}/media-manifest.json`);
    if (!response.ok) throw new ManifestUnavailableError(bookId);
    const body: unknown = await response.json();
    if (!isManifest(body)) throw new ManifestUnavailableError(bookId);
    return body;
  }
}
