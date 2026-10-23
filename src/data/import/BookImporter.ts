import type {
  BookImporterPort,
  ContentPack,
  ImportOutcome,
  ImportProgress,
} from '@/domain/contracts';
import { BookDataAdapter } from '../adapters/BookDataAdapter';
import type { LexiDatabase } from '../db/LexiDatabase';

const WORD_BATCH_SIZE = 500;

export class BookImporter implements BookImporterPort {
  constructor(
    private readonly db: LexiDatabase,
    private readonly adapter: BookDataAdapter = new BookDataAdapter(),
  ) {}

  async isImported(bookId: string): Promise<boolean> {
    return (await this.db.importState.get(bookId))?.status === 'done';
  }

  /**
   * Idempotent: ids are deterministic and writes use bulkPut. If the tab dies mid-import the state
   * stays 'importing', so the next launch simply runs the import again.
   */
  async import(
    pack: ContentPack,
    onProgress?: (progress: ImportProgress) => void,
    signal?: AbortSignal,
  ): Promise<ImportOutcome> {
    const { book } = pack;
    onProgress?.({ phase: 'loading', done: 0, total: 0 });

    const { raw, hash } = await pack.load(signal);
    const previous = await this.db.importState.get(book.id);
    if (previous?.status === 'done' && previous.contentHash === hash) return 'up-to-date';

    const { units, words } = this.adapter.adapt(book, raw);
    await this.db.importState.put({
      bookId: book.id,
      contentHash: hash,
      status: 'importing',
      updatedAt: Date.now(),
    });
    await this.db.units.bulkPut([...units]);

    let written = 0;
    for (let start = 0; start < words.length; start += WORD_BATCH_SIZE) {
      const batch = words.slice(start, start + WORD_BATCH_SIZE);
      await this.db.words.bulkPut(batch);
      written += batch.length;
      onProgress?.({ phase: 'writing', done: written, total: words.length });
    }

    const unitIds = new Set(units.map((unit) => unit.id));
    const wordIds = new Set(words.map((word) => word.id));
    await this.db.transaction('rw', this.db.books, this.db.units, this.db.words, this.db.importState, async () => {
      await this.db.units.where('bookId').equals(book.id).filter((unit) => !unitIds.has(unit.id)).delete();
      await this.db.words.where('bookId').equals(book.id).filter((word) => !wordIds.has(word.id)).delete();
      await this.db.books.put({ ...book, importedAt: Date.now(), version: hash });
      await this.db.importState.put({
        bookId: book.id,
        contentHash: hash,
        status: 'done',
        updatedAt: Date.now(),
      });
    });

    onProgress?.({ phase: 'done', done: words.length, total: words.length });
    return 'imported';
  }
}
