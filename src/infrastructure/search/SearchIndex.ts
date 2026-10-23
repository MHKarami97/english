import Fuse from 'fuse.js';
import type { Word } from '@/domain/entities';
import { splitPos } from '@/domain/parsing/pronunciation';

export interface SearchFilters {
  readonly unitId?: string;
  readonly pos?: string;
}

interface SearchDoc {
  readonly id: string;
  readonly unitId: string;
  readonly word: string;
  readonly definition: string;
  readonly example: string;
  readonly posTags: readonly string[];
}

const toDoc = (word: Word): SearchDoc => ({
  id: word.id,
  unitId: word.unitId,
  word: word.word,
  definition: word.definition,
  example: word.exampleSegments.map((segment) => segment.text).join(''),
  posTags: splitPos(word.pos).map((tag) => tag.toLowerCase()),
});

/** In-memory fuzzy index; ~4000 short records are cheaper to scan than to maintain in IndexedDB. */
export class SearchIndex {
  readonly posOptions: readonly string[];
  private readonly wordsById: ReadonlyMap<string, Word>;
  private readonly docs: SearchDoc[];
  private readonly fuse: Fuse<SearchDoc>;

  constructor(words: readonly Word[]) {
    this.wordsById = new Map(words.map((word) => [word.id, word]));
    this.docs = words.map(toDoc);
    this.posOptions = [...new Set(this.docs.flatMap((doc) => doc.posTags))].sort();
    this.fuse = new Fuse(this.docs, {
      keys: [
        { name: 'word', weight: 3 },
        { name: 'definition', weight: 1 },
        { name: 'example', weight: 1 },
      ],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }

  search(query: string, filters: SearchFilters, limit = 60): readonly Word[] {
    const text = query.trim();
    const hasFilter = Boolean(filters.unitId || filters.pos);
    if (text.length === 0 && !hasFilter) return [];

    const candidates =
      text.length >= 2 ? this.fuse.search(text).map((result) => result.item) : text.length === 0 ? this.docs : [];

    const results: Word[] = [];
    for (const doc of candidates) {
      if (filters.unitId && doc.unitId !== filters.unitId) continue;
      if (filters.pos && !doc.posTags.includes(filters.pos)) continue;
      const word = this.wordsById.get(doc.id);
      if (word) results.push(word);
      if (results.length >= limit) break;
    }
    return results;
  }
}
