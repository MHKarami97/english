import type { Book, BookRef, Unit, UserWordState, Word } from './entities';
import type { RawBookData } from './raw';

export interface BookRepository {
  list(): Promise<readonly Book[]>;
}

export interface UnitRepository {
  get(id: string): Promise<Unit | undefined>;
  listByBook(bookId: string): Promise<readonly Unit[]>;
}

export interface WordRepository {
  get(id: string): Promise<Word | undefined>;
  listByUnit(unitId: string): Promise<readonly Word[]>;
  listByBook(bookId: string): Promise<readonly Word[]>;
  getMany(ids: readonly string[]): Promise<readonly Word[]>;
}

export interface ProgressRepository {
  getMany(wordIds: readonly string[]): Promise<ReadonlyMap<string, UserWordState>>;
  listKnownIds(bookId: string): Promise<readonly string[]>;
  listFavoriteIds(bookId: string): Promise<readonly string[]>;
  save(state: UserWordState): Promise<void>;
  clearAll(): Promise<void>;
}

export interface SettingsRepository {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
}

export interface LoadedContent {
  readonly raw: RawBookData;
  readonly hash: string;
}

export interface ContentPack {
  readonly book: BookRef;
  load(signal?: AbortSignal): Promise<LoadedContent>;
}

export interface BookIndexSource {
  fetchBooks(): Promise<readonly BookRef[]>;
}

export interface ImportProgress {
  readonly phase: 'loading' | 'writing' | 'done';
  readonly done: number;
  readonly total: number;
}

export type ImportOutcome = 'imported' | 'up-to-date';

export interface BookImporterPort {
  isImported(bookId: string): Promise<boolean>;
  import(
    pack: ContentPack,
    onProgress?: (progress: ImportProgress) => void,
    signal?: AbortSignal,
  ): Promise<ImportOutcome>;
}
