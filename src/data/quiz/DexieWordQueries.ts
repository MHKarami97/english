import type { Knowledge } from '@/domain/entities';
import type { KnownMarker, KnownSnapshot, WordQueries } from '@/domain/quiz/ports';
import type { LexiDatabase, StoredWordState } from '../db/LexiDatabase';
import { fromStoredState } from '../wordStateMapping';

export class DexieWordQueries implements WordQueries {
  constructor(private readonly db: LexiDatabase) {}

  idsByUnit(unitId: string): Promise<readonly string[]> {
    return this.db.words.where('unitId').equals(unitId).primaryKeys();
  }

  idsByBook(bookId: string): Promise<readonly string[]> {
    return this.db.words.where('bookId').equals(bookId).primaryKeys();
  }

  idsByKnowledge(bookId: string, knowledge: Knowledge): Promise<readonly string[]> {
    return this.db.userWordState.where('[bookId+knowledge]').equals([bookId, knowledge]).primaryKeys();
  }
}

/** Writes the Phase 1 knowledge state and keeps what it overwrote, so one Undo can restore it. */
export class DexieKnownMarker implements KnownMarker {
  constructor(private readonly db: LexiDatabase) {}

  async countToMarkKnown(wordIds: readonly string[]): Promise<number> {
    const rows = await this.db.userWordState.bulkGet([...wordIds]);
    return rows.filter((row) => row?.knowledge !== 'known').length;
  }

  markKnown(bookId: string, wordIds: readonly string[], at: number): Promise<KnownSnapshot> {
    return this.db.transaction('rw', this.db.userWordState, async () => {
      const existing = await this.db.userWordState.bulkGet([...wordIds]);
      const entries: { wordId: string; previous: ReturnType<typeof fromStoredState> | null }[] = [];
      const writes: StoredWordState[] = [];
      wordIds.forEach((wordId, index) => {
        const current = existing[index];
        if (current?.knowledge === 'known') return;
        entries.push({ wordId, previous: current ? fromStoredState(current) : null });
        writes.push({ wordId, bookId, favorite: current?.favorite ?? 0, knowledge: 'known', updatedAt: at });
      });
      await this.db.userWordState.bulkPut(writes);
      return { entries };
    });
  }

  restore(snapshot: KnownSnapshot): Promise<void> {
    return this.db.transaction('rw', this.db.userWordState, async () => {
      for (const { wordId, previous } of snapshot.entries) {
        if (previous) {
          await this.db.userWordState.put({
            wordId: previous.wordId,
            bookId: previous.bookId,
            favorite: previous.isFavorite ? 1 : 0,
            knowledge: previous.knowledge,
            updatedAt: previous.updatedAt,
          });
        } else {
          await this.db.userWordState.delete(wordId);
        }
      }
    });
  }
}
