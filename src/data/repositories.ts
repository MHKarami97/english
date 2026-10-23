import type {
  BookRepository,
  ProgressRepository,
  SettingsRepository,
  UnitRepository,
  WordRepository,
} from '@/domain/contracts';
import type { Book, Unit, UserWordState, Word } from '@/domain/entities';
import type { LexiDatabase, StoredWordState } from './db/LexiDatabase';

const present = <T>(items: readonly (T | undefined)[]): T[] =>
  items.filter((item): item is T => item !== undefined);

export class DexieBookRepository implements BookRepository {
  constructor(private readonly db: LexiDatabase) {}

  list(): Promise<readonly Book[]> {
    return this.db.books.toArray();
  }
}

export class DexieUnitRepository implements UnitRepository {
  constructor(private readonly db: LexiDatabase) {}

  get(id: string): Promise<Unit | undefined> {
    return this.db.units.get(id);
  }

  listByBook(bookId: string): Promise<readonly Unit[]> {
    return this.db.units.where('bookId').equals(bookId).sortBy('order');
  }
}

export class DexieWordRepository implements WordRepository {
  constructor(private readonly db: LexiDatabase) {}

  get(id: string): Promise<Word | undefined> {
    return this.db.words.get(id);
  }

  listByUnit(unitId: string): Promise<readonly Word[]> {
    return this.db.words.where('unitId').equals(unitId).sortBy('order');
  }

  listByBook(bookId: string): Promise<readonly Word[]> {
    return this.db.words.where('bookId').equals(bookId).toArray();
  }

  async getMany(ids: readonly string[]): Promise<readonly Word[]> {
    return present(await this.db.words.bulkGet([...ids]));
  }
}

const toStored = (state: UserWordState): StoredWordState => ({
  wordId: state.wordId,
  bookId: state.bookId,
  favorite: state.isFavorite ? 1 : 0,
  knowledge: state.knowledge,
  updatedAt: state.updatedAt,
});

const fromStored = (row: StoredWordState): UserWordState => ({
  wordId: row.wordId,
  bookId: row.bookId,
  isFavorite: row.favorite === 1,
  knowledge: row.knowledge,
  updatedAt: row.updatedAt,
});

export class DexieProgressRepository implements ProgressRepository {
  constructor(private readonly db: LexiDatabase) {}

  async getMany(wordIds: readonly string[]): Promise<ReadonlyMap<string, UserWordState>> {
    const rows = present(await this.db.userWordState.bulkGet([...wordIds]));
    return new Map(rows.map((row) => [row.wordId, fromStored(row)]));
  }

  async listKnownIds(bookId: string): Promise<readonly string[]> {
    return this.db.userWordState.where('[bookId+knowledge]').equals([bookId, 'known']).primaryKeys();
  }

  async listFavoriteIds(bookId: string): Promise<readonly string[]> {
    return this.db.userWordState.where('[bookId+favorite]').equals([bookId, 1]).primaryKeys();
  }

  async save(state: UserWordState): Promise<void> {
    await this.db.userWordState.put(toStored(state));
  }

  clearAll(): Promise<void> {
    return this.db.userWordState.clear();
  }
}

export class DexieSettingsRepository implements SettingsRepository {
  constructor(private readonly db: LexiDatabase) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.settings.get(key);
    return row === undefined ? fallback : (row.value as T);
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.settings.put({ key, value });
  }
}
