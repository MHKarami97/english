import type { SettingsRepository, WordRepository } from '@/domain/contracts';
import type { Word } from '@/domain/entities';
import type { Mistake, PlacementResult } from '@/domain/quiz/models';
import type { MistakeRepository, PlacementRepository } from '@/domain/quiz/ports';
import { readSavedQuiz, type SavedQuizMeta } from './QuizSessionService';
import { SettingKey } from './settingKeys';

export interface PracticeHub {
  readonly mistakeCount: number;
  readonly placement: PlacementResult | null;
  readonly promptDismissed: boolean;
  readonly savedQuiz: SavedQuizMeta | null;
}

export interface MistakeEntry {
  readonly mistake: Mistake;
  readonly word: Word;
}

export class PracticeHubService {
  constructor(
    private readonly mistakes: MistakeRepository,
    private readonly placements: PlacementRepository,
    private readonly state: SettingsRepository,
    private readonly words: WordRepository,
  ) {}

  async load(bookId: string): Promise<PracticeHub> {
    const [mistakeCount, placement, promptDismissed, savedQuiz] = await Promise.all([
      this.mistakes.count(),
      this.placements.latest(bookId),
      this.state.get(SettingKey.placementPromptDismissed, false),
      readSavedQuiz(this.state, bookId),
    ]);
    return { mistakeCount, placement: placement ?? null, promptDismissed, savedQuiz };
  }

  async mistakeEntries(limit: number): Promise<readonly MistakeEntry[]> {
    const mistakes = await this.mistakes.list(limit);
    const words = new Map((await this.words.getMany(mistakes.map((mistake) => mistake.wordId))).map((word) => [word.id, word]));
    return mistakes.flatMap((mistake) => {
      const word = words.get(mistake.wordId);
      return word ? [{ mistake, word }] : [];
    });
  }

  dismissPlacementPrompt(): Promise<void> {
    return this.state.set(SettingKey.placementPromptDismissed, true);
  }
}
