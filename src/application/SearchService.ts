import type { UnitRepository, WordRepository } from '@/domain/contracts';
import { sortWordsByUnitOrder } from '@/domain/ordering';
import { SearchIndex } from '@/infrastructure/search/SearchIndex';

export class SearchService {
  private index: SearchIndex | null = null;
  private indexedBookId: string | null = null;

  constructor(
    private readonly units: UnitRepository,
    private readonly words: WordRepository,
  ) {}

  async prepare(bookId: string): Promise<SearchIndex> {
    if (this.index && this.indexedBookId === bookId) return this.index;
    const [words, units] = await Promise.all([
      this.words.listByBook(bookId),
      this.units.listByBook(bookId),
    ]);
    this.index = new SearchIndex(sortWordsByUnitOrder(words, units));
    this.indexedBookId = bookId;
    return this.index;
  }

  invalidate(): void {
    this.index = null;
    this.indexedBookId = null;
  }
}
