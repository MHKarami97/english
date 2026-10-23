import type { ProgressRepository, SettingsRepository } from '@/domain/contracts';
import type { Knowledge, UserWordState, Word } from '@/domain/entities';
import { SettingKey } from './settingKeys';

export class ProgressService {
  constructor(
    private readonly progress: ProgressRepository,
    private readonly settings: SettingsRepository,
  ) {}

  async statesFor(words: readonly Word[]): Promise<ReadonlyMap<string, UserWordState>> {
    return this.progress.getMany(words.map((word) => word.id));
  }

  setKnowledge(word: Word, knowledge: Knowledge): Promise<UserWordState> {
    return this.update(word, (current) => ({ ...current, knowledge }));
  }

  toggleFavorite(word: Word): Promise<UserWordState> {
    return this.update(word, (current) => ({ ...current, isFavorite: !current.isFavorite }));
  }

  async resetAll(): Promise<void> {
    await this.progress.clearAll();
    await this.settings.set(SettingKey.lastPosition, null);
  }

  private async update(
    word: Word,
    change: (current: UserWordState) => UserWordState,
  ): Promise<UserWordState> {
    const existing = (await this.progress.getMany([word.id])).get(word.id);
    const base: UserWordState = existing ?? {
      wordId: word.id,
      bookId: word.bookId,
      isFavorite: false,
      knowledge: 'new',
      updatedAt: 0,
    };
    const next = { ...change(base), updatedAt: Date.now() };
    await this.progress.save(next);
    return next;
  }
}
