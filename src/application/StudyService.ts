import type {
  ProgressRepository,
  SettingsRepository,
  UnitRepository,
  WordRepository,
} from '@/domain/contracts';
import type { Unit, Word } from '@/domain/entities';
import { sortWordsByUnitOrder } from '@/domain/ordering';
import { SettingKey } from './settingKeys';

export interface StudyPosition {
  readonly bookId: string;
  readonly unitId: string;
  readonly wordId: string;
}

export interface StudySession {
  readonly title: string;
  readonly words: readonly Word[];
}

export interface ContinueTarget {
  readonly unit: Unit;
  readonly word: Word;
}

export class StudyService {
  constructor(
    private readonly units: UnitRepository,
    private readonly words: WordRepository,
    private readonly progress: ProgressRepository,
    private readonly settings: SettingsRepository,
  ) {}

  async loadUnit(unitId: string): Promise<StudySession | undefined> {
    const unit = await this.units.get(unitId);
    if (!unit) return undefined;
    return { title: unit.title, words: await this.words.listByUnit(unitId) };
  }

  async loadFavorites(bookId: string): Promise<StudySession> {
    const [ids, units] = await Promise.all([
      this.progress.listFavoriteIds(bookId),
      this.units.listByBook(bookId),
    ]);
    const words = await this.words.getMany(ids);
    return { title: 'Favorites', words: sortWordsByUnitOrder(words, units) };
  }

  savePosition(position: StudyPosition): Promise<void> {
    return this.settings.set(SettingKey.lastPosition, position);
  }

  async resolveContinue(bookId: string): Promise<ContinueTarget | undefined> {
    const position = await this.settings.get<StudyPosition | null>(SettingKey.lastPosition, null);
    if (!position || position.bookId !== bookId) return undefined;
    const [unit, word] = await Promise.all([
      this.units.get(position.unitId),
      this.words.get(position.wordId),
    ]);
    return unit && word ? { unit, word } : undefined;
  }
}
