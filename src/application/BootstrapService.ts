import type {
  BookImporterPort,
  BookIndexSource,
  BookRepository,
  ContentPack,
  ImportProgress,
} from '@/domain/contracts';
import type { BookRef } from '@/domain/entities';

export interface EnsureBookOptions {
  readonly onProgress?: (progress: ImportProgress) => void;
  readonly onRefreshed?: () => void;
}

export class BootstrapService {
  constructor(
    private readonly books: BookRepository,
    private readonly importer: BookImporterPort,
    private readonly index: BookIndexSource,
    private readonly createPack: (book: BookRef) => ContentPack,
    /** Runs after a background refresh brought new content, before the UI is told about it. */
    private readonly afterRefresh?: (bookId: string) => Promise<void>,
  ) {}

  /** Offline launches fall back to the books already stored in IndexedDB. */
  async loadBookRefs(): Promise<readonly BookRef[]> {
    try {
      return await this.index.fetchBooks();
    } catch (error) {
      const stored = await this.books.list();
      if (stored.length > 0) return stored;
      throw error;
    }
  }

  async ensureBook(book: BookRef, options: EnsureBookOptions = {}): Promise<void> {
    const pack = this.createPack(book);
    if (await this.importer.isImported(book.id)) {
      // Content is usable immediately; revalidate quietly and only notify if it actually changed.
      void this.importer
        .import(pack)
        .then(async (outcome) => {
          if (outcome !== 'imported') return;
          await this.afterRefresh?.(book.id).catch(() => undefined);
          options.onRefreshed?.();
        })
        .catch(() => undefined);
      return;
    }
    await this.importer.import(pack, options.onProgress);
  }
}
